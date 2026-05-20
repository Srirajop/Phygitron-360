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
    pool_size=10,
    max_overflow=20,
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
