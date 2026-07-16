"""
Phygitron 360 — ATS Celery Tasks
==================================
Background scoring tasks for candidate-to-role fit scoring at scale.
Designed to handle 15,000+ resumes without blocking the main API thread.
"""
import json
import logging
from backend.core.celery_app import celery_app
from backend.modules.source.services.ats_engine import (
    normalise_required_skills, calculate_role_fit
)

logger = logging.getLogger(__name__)

BATCH_SIZE = 500  # Candidates processed per DB round-trip


def _parse_skill_list(skills):
    """Parse skills from DB — handles list, JSON string, or CSV string."""
    if not skills:
        return []
    if isinstance(skills, list):
        return [str(s) for s in skills]
    if isinstance(skills, str):
        try:
            parsed = json.loads(skills)
            if isinstance(parsed, list):
                return [str(s) for s in parsed]
        except Exception:
            pass
        if "," in skills:
            return [s.strip() for s in skills.split(",") if s.strip()]
        return [skills]
    return []


def _run_score_all_candidates_for_role(role_id: int, tenant_id: str):
    from backend.core.database import get_db_connection
    from psycopg2.extras import RealDictCursor

    logger.info(f"[ATS] Starting bulk scoring for role {role_id} in tenant {tenant_id}")

    conn = get_db_connection()
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(f'SET search_path TO "{tenant_id}"')

            # Fetch the job role
            cur.execute("SELECT id, title, description, required_skills, min_experience FROM job_roles WHERE id = %s", (role_id,))
            role = cur.fetchone()
            if not role:
                logger.warning(f"[ATS] Role {role_id} not found in tenant {tenant_id}")
                return {"status": "error", "message": "Role not found"}

            req_skills = normalise_required_skills(
                role["required_skills"],
                title=role["title"] or "",
                description=role["description"] or "",
            )
            min_exp = role.get("min_experience") or 0

            if not req_skills:
                logger.warning(f"[ATS] Role {role_id} has no required skills — skipping bulk score")
                return {"status": "skipped", "message": "No required skills defined for this role"}

            # Count total candidates for logging
            cur.execute("SELECT COUNT(*) FROM candidates WHERE status NOT IN ('Archived', 'Rejected')")
            total = cur.fetchone()["count"]
            logger.info(f"[ATS] Scoring {total} candidates for role {role_id} ({role['title']}) in {tenant_id}")

            scored = 0
            offset = 0

            while True:
                cur.execute("""
                    SELECT id, primary_skills, secondary_skills, total_experience_years
                    FROM candidates
                    WHERE status NOT IN ('Archived', 'Rejected')
                    ORDER BY id
                    LIMIT %s OFFSET %s
                """, (BATCH_SIZE, offset))
                batch = cur.fetchall()
                if not batch:
                    break

                for cand in batch:
                    try:
                        primary = _parse_skill_list(cand["primary_skills"])
                        secondary = _parse_skill_list(cand["secondary_skills"])
                        cand_skills = (
                            [{"name": s, "level": "intermediate"} for s in primary] +
                            [{"name": s, "level": "beginner"} for s in secondary]
                        )
                        exp_years = int(cand["total_experience_years"] or 0)
                        fit = calculate_role_fit(cand_skills, req_skills, exp_years=exp_years, min_exp=min_exp)
                        score = fit["score"]
                        reasoning = json.dumps({
                            "matched": fit["matched_skills"],
                            "missing": fit["missing_skills"],
                            "partial": fit["partial_skills"],
                        })

                        # Upsert score
                        cur.execute("""
                            SELECT id FROM ai_scores
                            WHERE entity_type = 'candidate' AND entity_id = %s AND job_role_id = %s AND score_type = 'role_fit'
                        """, (cand["id"], role_id))
                        existing = cur.fetchone()
                        if existing:
                            cur.execute("""
                                UPDATE ai_scores SET score = %s, reasoning = %s, computed_at = CURRENT_TIMESTAMP
                                WHERE id = %s
                            """, (score, reasoning, existing["id"]))
                        else:
                            cur.execute("""
                                INSERT INTO ai_scores (entity_type, entity_id, job_role_id, score_type, score, reasoning)
                                VALUES ('candidate', %s, %s, 'role_fit', %s, %s)
                            """, (cand["id"], role_id, score, reasoning))

                        scored += 1
                    except Exception as e:
                        logger.warning(f"[ATS] Failed scoring candidate {cand['id']}: {e}")

                conn.commit()
                offset += BATCH_SIZE
                logger.info(f"[ATS] Progress: {min(offset, total)}/{total} candidates scored for role {role_id}")

        logger.info(f"[ATS] Bulk scoring complete: {scored} candidates scored for role {role_id} in tenant {tenant_id}")
        return {"status": "complete", "scored": scored, "total": total}

    except Exception as exc:
        conn.rollback()
        raise exc
    finally:
        conn.close()


@celery_app.task(name="score_all_candidates_for_role", bind=True, max_retries=3)
def score_all_candidates_for_role(self, role_id: int, tenant_id: str):
    """
    Score ALL candidates in a tenant against a single job role.
    Runs in batches of BATCH_SIZE to avoid memory issues with large datasets.
    ~15,000 resumes in ~30 seconds.
    """
    try:
        return _run_score_all_candidates_for_role(role_id, tenant_id)
    except Exception as exc:
        logger.error(f"[ATS] Bulk scoring failed for role {role_id}: {exc}")
        raise self.retry(exc=exc, countdown=30)


def _run_score_new_candidate_for_all_roles(candidate_id: int, tenant_id: str):
    from backend.core.database import get_db_connection
    from psycopg2.extras import RealDictCursor

    logger.info(f"[ATS] Scoring new candidate {candidate_id} against all roles in tenant {tenant_id}")

    conn = get_db_connection()
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(f'SET search_path TO "{tenant_id}"')

            # Fetch candidate
            cur.execute("""
                SELECT id, primary_skills, secondary_skills, total_experience_years
                FROM candidates WHERE id = %s
            """, (candidate_id,))
            cand = cur.fetchone()
            if not cand:
                return {"status": "error", "message": "Candidate not found"}

            primary = _parse_skill_list(cand["primary_skills"])
            secondary = _parse_skill_list(cand["secondary_skills"])
            cand_skills = (
                [{"name": s, "level": "intermediate"} for s in primary] +
                [{"name": s, "level": "beginner"} for s in secondary]
            )
            exp_years = int(cand["total_experience_years"] or 0)

            # Fetch all active job roles
            cur.execute("SELECT id, title, description, required_skills, min_experience FROM job_roles")
            roles = cur.fetchall()

            scored = 0
            for role in roles:
                try:
                    req_skills = normalise_required_skills(
                        role["required_skills"],
                        title=role["title"] or "",
                        description=role["description"] or "",
                    )
                    if not req_skills:
                        continue

                    fit = calculate_role_fit(cand_skills, req_skills, exp_years=exp_years, min_exp=role.get("min_experience") or 0)
                    score = fit["score"]
                    reasoning = json.dumps({"matched": fit["matched_skills"], "missing": fit["missing_skills"]})

                    cur.execute("""
                        SELECT id FROM ai_scores
                        WHERE entity_type = 'candidate' AND entity_id = %s AND job_role_id = %s AND score_type = 'role_fit'
                    """, (candidate_id, role["id"]))
                    existing = cur.fetchone()
                    if existing:
                        cur.execute("""
                            UPDATE ai_scores SET score = %s, reasoning = %s, computed_at = CURRENT_TIMESTAMP
                            WHERE id = %s
                        """, (score, reasoning, existing["id"]))
                    else:
                        cur.execute("""
                            INSERT INTO ai_scores (entity_type, entity_id, job_role_id, score_type, score, reasoning)
                            VALUES ('candidate', %s, %s, 'role_fit', %s, %s)
                        """, (candidate_id, role["id"], score, reasoning))
                    scored += 1
                except Exception as e:
                    logger.warning(f"[ATS] Failed scoring candidate {candidate_id} against role {role['id']}: {e}")

            conn.commit()
            logger.info(f"[ATS] New candidate {candidate_id} scored against {scored} roles in {tenant_id}")
            return {"status": "complete", "scored_roles": scored}

    except Exception as exc:
        conn.rollback()
        raise exc
    finally:
        conn.close()

@celery_app.task(name="score_new_candidate_for_all_roles", bind=True, max_retries=3)
def score_new_candidate_for_all_roles(self, candidate_id: int, tenant_id: str):
    """
    Score a single newly uploaded candidate against ALL active job roles in the tenant.
    Triggered automatically when a new resume is parsed and saved.
    """
    try:
        return _run_score_new_candidate_for_all_roles(candidate_id, tenant_id)
    except Exception as exc:
        logger.error(f"[ATS] Candidate scoring failed for {candidate_id}: {exc}")
        raise self.retry(exc=exc, countdown=30)
