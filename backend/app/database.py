from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase
from sqlalchemy import event, inspect
from app.config import settings


class Base(DeclarativeBase):
    pass


engine = create_async_engine(
    settings.DATABASE_URL,
    echo=settings.APP_ENV == "development",
    pool_pre_ping=True,
    pool_size=20,          # was 10 — supports 8 AI workers + request handlers
    max_overflow=40,       # was 20 — burst headroom for large bulk uploads
    pool_timeout=60,       # wait up to 60s for a free connection before erroring
    pool_recycle=1800,     # recycle connections every 30 min to avoid stale sockets
)

AsyncSessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autoflush=False,
    autocommit=False,
)


async def get_db():
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


async def init_db():
    """Create all tables on startup."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        await conn.run_sync(_ensure_learning_progress_columns)
        await conn.run_sync(_ensure_source_columns)


def _ensure_learning_progress_columns(sync_conn):
    """Backfill newer learning progress columns for existing databases."""
    inspector = inspect(sync_conn)
    try:
        columns = {col["name"] for col in inspector.get_columns("learning_progress")}
    except Exception:
        return

    additions = {
        "progress_percent": "ALTER TABLE learning_progress ADD COLUMN progress_percent DECIMAL(5, 2) DEFAULT 0.0",
        "scorm_progress_percent": "ALTER TABLE learning_progress ADD COLUMN scorm_progress_percent DECIMAL(5, 2) NULL",
        "scorm_score": "ALTER TABLE learning_progress ADD COLUMN scorm_score DECIMAL(5, 2) NULL",
        "scorm_status": "ALTER TABLE learning_progress ADD COLUMN scorm_status VARCHAR(64) NULL",
        "scorm_location": "ALTER TABLE learning_progress ADD COLUMN scorm_location VARCHAR(255) NULL",
        "scorm_suspend_data": "ALTER TABLE learning_progress ADD COLUMN scorm_suspend_data TEXT NULL",
        "last_scorm_commit_at": "ALTER TABLE learning_progress ADD COLUMN last_scorm_commit_at DATETIME NULL",
    }

    for name, sql in additions.items():
        if name not in columns:
            sync_conn.exec_driver_sql(sql)


def _ensure_source_columns(sync_conn):
    inspector = inspect(sync_conn)
    try:
        candidate_columns = {col["name"] for col in inspector.get_columns("candidates")}
    except Exception:
        return

    if "resume_hash" not in candidate_columns:
        sync_conn.exec_driver_sql("ALTER TABLE candidates ADD COLUMN resume_hash VARCHAR(64) NULL")

    try:
        cand_indexes = {idx["name"] for idx in inspector.get_indexes("candidates")}
    except Exception:
        cand_indexes = set()

    if "idx_candidates_org_resume_hash" not in cand_indexes:
        sync_conn.exec_driver_sql(
            "CREATE INDEX idx_candidates_org_resume_hash ON candidates (org_id, resume_hash)"
        )

    # Performance index: fast org-scoped lookups used in search_candidates
    if "idx_candidates_org_created" not in cand_indexes:
        sync_conn.exec_driver_sql(
            "CREATE INDEX idx_candidates_org_created ON candidates (org_id, created_at DESC)"
        )

    # Performance index: fast batch IN-clause skill lookups (was N+1 → now 1 query)
    try:
        skill_indexes = {idx["name"] for idx in inspector.get_indexes("candidate_skills")}
    except Exception:
        skill_indexes = set()

    if "idx_candidate_skills_candidate_id" not in skill_indexes:
        sync_conn.exec_driver_sql(
            "CREATE INDEX idx_candidate_skills_candidate_id ON candidate_skills (candidate_id)"
        )
