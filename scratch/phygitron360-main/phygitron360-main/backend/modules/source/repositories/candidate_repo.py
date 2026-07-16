import json
import logging
from typing import Optional, List, Dict, Any

logger = logging.getLogger(__name__)
from backend.core.database import get_db_connection
from psycopg2.extras import RealDictCursor

class CandidateRepository:
    def __init__(self, tenant_id: str = 'public'):
        self.tenant_id = tenant_id

    def _set_search_path(self, cur):
        cur.execute(f'SET search_path TO "{self.tenant_id}"')

    def create_candidate(self, data: Dict[str, Any], conn=None, cur=None) -> int:
        should_close = False
        if conn is None:
            conn = get_db_connection()
            cur = conn.cursor()
            should_close = True
        try:
            self._set_search_path(cur)
            
            # 1. Main Candidate Row
            cur.execute('''
                INSERT INTO candidates 
                (full_name, email, phone, location, total_experience_years, 
                 current_designation, resume_path, resume_url, status, source, user_id, ai_summary, linkedin_url, portfolio_url, certifications, primary_skills, secondary_skills) 
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                RETURNING id
            ''', (
                data.get("full_name"),
                data.get("email"),
                data.get("phone"),
                data.get("location"),
                data.get("total_experience_years", 0),
                data.get("current_designation"),
                data.get("resume_path"),
                data.get("resume_url"),
                data.get("status", "New"),
                data.get("source", "Manual"),
                data.get("user_id"),
                data.get("ai_summary"),
                data.get("linkedin_url"),
                data.get("portfolio_url"),
                json.dumps(data.get("certifications", [])),
                data.get("primary_skills", []),
                data.get("secondary_skills", [])
            ))
            candidate_id = cur.fetchone()[0]

            # 2. Experience
            for exp in data.get("experience", []):
                cur.execute('''
                    INSERT INTO candidate_experience 
                    (candidate_id, company, designation, start_date, end_date, is_current, description)
                    VALUES (%s, %s, %s, %s, %s, %s, %s)
                ''', (
                    candidate_id,
                    exp.get("company"),
                    exp.get("designation"),
                    exp.get("start_date"),
                    exp.get("end_date"),
                    exp.get("is_current", False),
                    exp.get("description")
                ))

            # 3. Education
            for edu in data.get("education", []):
                cur.execute('''
                    INSERT INTO candidate_education 
                    (candidate_id, institution, degree, field_of_study, start_date, end_date)
                    VALUES (%s, %s, %s, %s, %s, %s)
                ''', (
                    candidate_id,
                    edu.get("institution"),
                    edu.get("degree"),
                    edu.get("field_of_study"),
                    edu.get("start_date"),
                    edu.get("end_date")
                ))

            if should_close:
                conn.commit()
            return candidate_id
        except Exception as e:
            if should_close:
                conn.rollback()
            raise e
        finally:
            if should_close:
                cur.close()
                conn.close()

    def get_candidate_by_email(self, email: str, conn=None, cur=None) -> Optional[Dict[str, Any]]:
        should_close = False
        if conn is None:
            conn = get_db_connection()
            cur = conn.cursor(cursor_factory=RealDictCursor)
            should_close = True
            
        try:
            self._set_search_path(cur)
            cur.execute("SELECT * FROM candidates WHERE email = %s", (email,))
            row = cur.fetchone()
            return dict(row) if row else None
        finally:
            if should_close:
                cur.close()
                conn.close()

    def update_candidate(self, candidate_id: int, data: Dict[str, Any], conn=None, cur=None) -> bool:
        should_close = False
        if conn is None:
            conn = get_db_connection()
            cur = conn.cursor()
            should_close = True
        try:
            self._set_search_path(cur)
            
            # Update main table
            cur.execute('''
                UPDATE candidates 
                SET full_name = %s, phone = %s, location = %s, total_experience_years = %s,
                    current_designation = %s,
                    ai_summary = %s, linkedin_url = %s, portfolio_url = %s,
                    certifications = %s, primary_skills = %s, secondary_skills = %s,
                    resume_path = COALESCE(%s, resume_path),
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = %s
            ''', (
                data.get("full_name"),
                data.get("phone"),
                data.get("location"),
                data.get("total_experience_years", 0),
                data.get("current_designation"),
                data.get("ai_summary"),
                data.get("linkedin_url"),
                data.get("portfolio_url"),
                json.dumps(data.get("certifications", [])),
                data.get("primary_skills", []),
                data.get("secondary_skills", []),
                data.get("resume_path"),
                candidate_id
            ))

            # Clear old many-to-one data for refresh
            cur.execute("DELETE FROM candidate_experience WHERE candidate_id = %s", (candidate_id,))
            cur.execute("DELETE FROM candidate_education WHERE candidate_id = %s", (candidate_id,))

            # Re-insert fresh experience
            for exp in data.get("experience", []):
                cur.execute('''
                    INSERT INTO candidate_experience 
                    (candidate_id, company, designation, start_date, end_date, is_current, description)
                    VALUES (%s, %s, %s, %s, %s, %s, %s)
                ''', (candidate_id, exp.get("company"), exp.get("designation"), exp.get("start_date"), exp.get("end_date"), exp.get("is_current", False), exp.get("description")))

            # Re-insert fresh education
            for edu in data.get("education", []):
                cur.execute('''
                    INSERT INTO candidate_education 
                    (candidate_id, institution, degree, field_of_study, start_date, end_date)
                    VALUES (%s, %s, %s, %s, %s, %s)
                ''', (candidate_id, edu.get("institution"), edu.get("degree"), edu.get("field_of_study"), edu.get("start_date"), edu.get("end_date")))

            if should_close:
                conn.commit()
            return True
        except Exception as e:
            if should_close:
                conn.rollback()
            raise e
        finally:
            if should_close:
                cur.close()
                conn.close()

    def get_all_candidates(self, page: int = 1, page_size: int = 20) -> List[Dict[str, Any]]:
        conn = get_db_connection()
        try:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                self._set_search_path(cur)
                offset = (page - 1) * page_size
                cur.execute('''
                    SELECT * FROM candidates ORDER BY created_at DESC LIMIT %s OFFSET %s
                ''', (page_size, offset))
                rows = cur.fetchall()
                return [dict(r) for r in rows]
        finally:
            conn.close()

    def get_candidates_count(self) -> int:
        conn = get_db_connection()
        try:
            with conn.cursor() as cur:
                self._set_search_path(cur)
                cur.execute('SELECT COUNT(*) FROM candidates')
                return cur.fetchone()[0]
        finally:
            conn.close()

    def get_candidate_by_id(self, candidate_id: int, role_id: Optional[int] = None) -> Optional[Dict[str, Any]]:
        conn = get_db_connection()
        try:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                self._set_search_path(cur)
                if role_id:
                    cur.execute("""
                        SELECT c.*, ca.status as job_status 
                        FROM candidates c
                        LEFT JOIN candidate_applications ca ON c.id = ca.candidate_id AND ca.job_role_id = %s
                        WHERE c.id = %s
                    """, (role_id, candidate_id))
                else:
                    cur.execute("SELECT * FROM candidates WHERE id = %s", (candidate_id,))
                row = cur.fetchone()
                if not row:
                    return None
                
                result = dict(row)
                if role_id:
                    result['status'] = result.get('job_status') or result['status']
                
                # Fetch related data
                cur.execute("SELECT * FROM candidate_experience WHERE candidate_id = %s", (candidate_id,))
                result['experience'] = [dict(r) for r in cur.fetchall()]
                
                cur.execute("SELECT * FROM candidate_education WHERE candidate_id = %s", (candidate_id,))
                result['education'] = [dict(r) for r in cur.fetchall()]
                
                cur.execute("SELECT * FROM candidate_notes WHERE candidate_id = %s ORDER BY created_at DESC", (candidate_id,))
                result['notes'] = [dict(r) for r in cur.fetchall()]
                
                cur.execute("SELECT * FROM candidate_activity_log WHERE candidate_id = %s ORDER BY created_at DESC", (candidate_id,))
                result['activity_log'] = [dict(r) for r in cur.fetchall()]
                
                cur.execute("SELECT * FROM ai_scores WHERE entity_type = 'candidate' AND entity_id = %s ORDER BY computed_at DESC", (candidate_id,))
                result['ai_scores'] = [dict(r) for r in cur.fetchall()]

                # Fetch Verify assessments and Forge courses if user_id is linked
                user_id = result.get('user_id')
                if user_id:
                    cur.execute("""
                        SELECT ar.*, a.title as assessment_title, a.pass_score
                        FROM assessment_results ar
                        JOIN assessments a ON ar.assessment_id = a.id
                        WHERE ar.user_id = %s
                        ORDER BY ar.submitted_at DESC
                    """, (user_id,))
                    result['assessment_results'] = [dict(r) for r in cur.fetchall()]

                    cur.execute("""
                        SELECT ce.*, c.title as course_title, c.difficulty_level
                        FROM course_enrollments ce
                        JOIN courses c ON ce.course_id = c.id
                        WHERE ce.user_id = %s
                        ORDER BY ce.created_at DESC
                    """, (user_id,))
                    result['course_enrollments'] = [dict(r) for r in cur.fetchall()]
                else:
                    result['assessment_results'] = []
                    result['course_enrollments'] = []

                # Cast Decimal to float and datetime to ISO string recursively
                from decimal import Decimal
                from datetime import datetime

                def serialize_special(obj):
                    if isinstance(obj, dict):
                        return {k: serialize_special(v) for k, v in obj.items()}
                    elif isinstance(obj, list):
                        return [serialize_special(i) for i in obj]
                    elif isinstance(obj, Decimal):
                        return float(obj)
                    elif isinstance(obj, datetime):
                        return obj.isoformat()
                    return obj
                
                return serialize_special(result)
        finally:
            conn.close()

    def update_candidate_status(self, candidate_id: int, new_status: str, role_id: Optional[int] = None) -> bool:
        conn = get_db_connection()
        try:
            with conn.cursor() as cur:
                self._set_search_path(cur)
                if role_id:
                    cur.execute('''
                        INSERT INTO candidate_applications (candidate_id, job_role_id, status)
                        VALUES (%s, %s, %s)
                        ON CONFLICT (candidate_id, job_role_id) 
                        DO UPDATE SET status = EXCLUDED.status, updated_at = CURRENT_TIMESTAMP
                    ''', (candidate_id, role_id, new_status))
                # Always update the candidates table status too
                cur.execute(
                    "UPDATE candidates SET status = %s, updated_at = CURRENT_TIMESTAMP WHERE id = %s",
                    (new_status, candidate_id)
                )
                conn.commit()
                return True
        finally:
            conn.close()

    def create_candidate_application(self, candidate_id: int, role_id: int, status: str = "New"):
        conn = get_db_connection()
        try:
            with conn.cursor() as cur:
                self._set_search_path(cur)
                cur.execute('''
                    INSERT INTO candidate_applications (candidate_id, job_role_id, status)
                    VALUES (%s, %s, %s)
                    ON CONFLICT (candidate_id, job_role_id) DO NOTHING
                ''', (candidate_id, role_id, status))
                conn.commit()
        finally:
            conn.close()

    def add_candidate_note(self, candidate_id: int, author_name: str, content: str) -> Dict[str, Any]:
        conn = get_db_connection()
        try:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                self._set_search_path(cur)
                cur.execute('''
                    INSERT INTO candidate_notes (candidate_id, author_name, content)
                    VALUES (%s, %s, %s)
                    RETURNING *
                ''', (candidate_id, author_name, content))
                row = cur.fetchone()
                conn.commit()
                return dict(row) if row else None
        except Exception as e:
            conn.rollback()
            raise e
        finally:
            conn.close()

    def get_candidate_skills(self, candidate_id: int) -> List[Dict[str, Any]]:
        conn = get_db_connection()
        try:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                self._set_search_path(cur)
                cur.execute('''
                    SELECT cs.*, st.name as skill_name, st.category as skill_category
                    FROM candidate_skills cs
                    JOIN skill_taxonomy st ON cs.skill_id = st.id
                    WHERE cs.candidate_id = %s
                ''', (candidate_id,))
                return [dict(r) for r in cur.fetchall()]
        finally:
            conn.close()

    def upsert_candidate_skill(self, candidate_id: int, skill_id: int, data: Dict[str, Any]):
        conn = get_db_connection()
        try:
            with conn.cursor() as cur:
                self._set_search_path(cur)
                cur.execute('''
                    INSERT INTO candidate_skills (candidate_id, skill_id, level, source, years_of_use, evidence)
                    VALUES (%s, %s, %s, %s, %s, %s)
                    ON CONFLICT (candidate_id, skill_id) DO UPDATE SET
                    level = EXCLUDED.level,
                    source = EXCLUDED.source,
                    years_of_use = EXCLUDED.years_of_use,
                    evidence = EXCLUDED.evidence,
                    updated_at = CURRENT_TIMESTAMP
                ''', (
                    candidate_id, skill_id, 
                    data.get("level", "beginner"), 
                    data.get("source", "resume"),
                    data.get("years_of_use"),
                    data.get("evidence")
                ))
                conn.commit()
        finally:
            conn.close()

    def search_candidates(self, pool: Optional[str] = None, location: Optional[str] = None, min_exp: Optional[float] = None, exp_range: Optional[str] = None, search: Optional[str] = None, sort_by: str = "newest", limit: int = 20, role_id: Optional[int] = None) -> List[Dict[str, Any]]:
        conn = get_db_connection()
        try:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                self._set_search_path(cur)
                
                conditions = []
                params = []

                if role_id:
                    # When searching by role_id, check the job-specific status or fallback to global
                    if pool and pool != "all":
                        conditions.append("COALESCE(ca.status, c.status) = %s")
                        params.append(pool.capitalize())
                else:
                    if pool and pool != "all":
                        conditions.append("c.status = %s")
                        params.append(pool.capitalize())

                if location:
                    conditions.append("c.location ILIKE %s")
                    params.append(f"%{location}%")

                if min_exp is not None:
                    conditions.append("c.total_experience_years >= %s")
                    params.append(min_exp)

                if exp_range:
                    if exp_range == "fresher":
                        conditions.append("c.total_experience_years < 1")
                    elif exp_range == "1-2":
                        conditions.append("c.total_experience_years >= 1 AND c.total_experience_years <= 2")
                    elif exp_range == "2-5":
                        conditions.append("c.total_experience_years > 2 AND c.total_experience_years <= 5")
                    elif exp_range == "5+":
                        conditions.append("c.total_experience_years > 5")

                if search:
                    conditions.append("(c.full_name ILIKE %s OR c.email ILIKE %s OR c.current_designation ILIKE %s)")
                    params.extend([f"%{search}%", f"%{search}%", f"%{search}%"])

                where_clause = ("WHERE " + " AND ".join(conditions)) if conditions else ""
                order_clause = "ORDER BY c.created_at DESC" if sort_by == "newest" else "ORDER BY c.total_experience_years DESC"
                params.append(limit)

                if role_id:
                    count_sql = f"""
                        SELECT COUNT(*) as total
                        FROM candidates c
                        LEFT JOIN candidate_applications ca ON c.id = ca.candidate_id AND ca.job_role_id = %s
                        {where_clause}
                    """
                    count_params = [role_id] + params[:-1]
                    cur.execute(count_sql, tuple(count_params))
                    total_count = cur.fetchone()['total']

                    sql = f"""
                        SELECT c.*, ca.status as job_status
                        FROM candidates c
                        LEFT JOIN candidate_applications ca ON c.id = ca.candidate_id AND ca.job_role_id = %s
                        {where_clause}
                        {order_clause}
                        LIMIT %s
                    """
                    params.insert(0, role_id)
                else:
                    count_sql = f"""
                        SELECT COUNT(*) as total
                        FROM candidates c
                        {where_clause}
                    """
                    count_params = params[:-1]
                    cur.execute(count_sql, tuple(count_params))
                    total_count = cur.fetchone()['total']

                    sql = f"""
                        SELECT c.*, c.status as job_status
                        FROM candidates c
                        {where_clause}
                        {order_clause}
                        LIMIT %s
                    """
                cur.execute(sql, tuple(params))
                
                # Normalize job_status to status so frontend works seamlessly
                results = []
                for r in cur.fetchall():
                    row = dict(r)
                    row['status'] = row.get('job_status') or row['status']
                    results.append(row)
                return results, total_count
        finally:
            conn.close()

    def get_active_candidates(self) -> List[Dict[str, Any]]:
        conn = get_db_connection()
        try:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                self._set_search_path(cur)
                cur.execute(
                    """SELECT 
                           c.*, 
                           u.last_login,
                           ci.job_role_id,
                           j.title as job_title,
                           fit.score as ai_fit_score,
                           conf.reasoning as confidence_signals
                       FROM candidates c
                       LEFT JOIN users u ON c.user_id = u.id
                       LEFT JOIN candidate_invites ci ON ci.candidate_id = c.id
                       LEFT JOIN job_roles j ON j.id = ci.job_role_id
                       LEFT JOIN ai_scores fit ON fit.entity_id = c.id AND fit.entity_type = 'candidate' AND fit.score_type = 'role_fit' AND fit.job_role_id = ci.job_role_id
                       LEFT JOIN ai_scores conf ON conf.entity_id = c.id AND conf.entity_type = 'candidate' AND conf.score_type = 'confidence_signals'
                       WHERE c.status = 'Invited'
                       ORDER BY c.created_at DESC"""
                )
                rows = []
                import json
                for r in cur.fetchall():
                    row = dict(r)
                    has_flags = False
                    signals_data = []
                    if row.get("confidence_signals"):
                        try:
                            signals = json.loads(row["confidence_signals"])
                            if isinstance(signals, list):
                                has_flags = any(s.get("flag", False) for s in signals)
                                signals_data = signals
                        except:
                            pass
                    row["insights"] = {
                        "final_score": float(row.get("ai_fit_score") or 0),
                        "has_malpractice": has_flags,
                        "signals": signals_data,
                        "job_title": row.get("job_title")
                    }
                    rows.append(row)
                return rows
        finally:
            conn.close()

    def get_candidate_latest_offer(self, candidate_id: int) -> Optional[Dict[str, Any]]:
        conn = get_db_connection()
        try:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                self._set_search_path(cur)
                cur.execute(
                    "SELECT * FROM offer_letters WHERE candidate_id = %s ORDER BY created_at DESC LIMIT 1",
                    (candidate_id,)
                )
                row = cur.fetchone()
                return dict(row) if row else None
        finally:
            conn.close()

    def create_bulk_upload_job(self, user_id: int, total_files: int) -> int:
        conn = get_db_connection()
        try:
            with conn.cursor() as cur:
                self._set_search_path(cur)
                cur.execute(
                    """INSERT INTO bulk_upload_jobs (created_by, total_files, status)
                       VALUES (%s, %s, 'processing') RETURNING id""",
                    (user_id, total_files)
                )
                job_id = cur.fetchone()[0]
                conn.commit()
                return job_id
        finally:
            conn.close()

    def update_bulk_upload_job(self, job_id: int, processed: int, details: str, status: str):
        conn = get_db_connection()
        try:
            with conn.cursor() as cur:
                self._set_search_path(cur)
                cur.execute(
                    """UPDATE bulk_upload_jobs
                       SET status = %s, processed_files = %s,
                           processed_details = %s, updated_at = CURRENT_TIMESTAMP
                       WHERE id = %s""",
                    (status, processed, details, job_id)
                )
                conn.commit()
        finally:
            conn.close()

    def create_bulk_upload_job_items(self, job_id: int, items: List[Dict[str, str]]):
        conn = get_db_connection()
        try:
            with conn.cursor() as cur:
                self._set_search_path(cur)
                from psycopg2.extras import execute_values
                query = """
                    INSERT INTO bulk_upload_job_items (job_id, filename, file_path, file_hash, extracted_text)
                    VALUES %s
                """
                values = [
                    (job_id, i["filename"], i["file_path"], i["file_hash"], i.get("extracted_text"))
                    for i in items
                ]
                execute_values(cur, query, values)
                conn.commit()
        finally:
            conn.close()

    def update_bulk_upload_job_item(self, item_id: int, status: str, candidate_id: Optional[int] = None, error_message: Optional[str] = None, conn=None, cur=None):
        should_close = False
        if conn is None:
            conn = get_db_connection()
            cur = conn.cursor()
            should_close = True
        try:
            self._set_search_path(cur)
            cur.execute(
                """UPDATE bulk_upload_job_items
                   SET status = %s, candidate_id = %s, error_message = %s, updated_at = CURRENT_TIMESTAMP
                   WHERE id = %s""",
                (status, candidate_id, error_message, item_id)
            )
            if should_close:
                conn.commit()
        except Exception as e:
            if should_close:
                conn.rollback()
            raise e
        finally:
            if should_close:
                cur.close()
                conn.close()

    def reset_stuck_processing_items(self):
        conn = get_db_connection()
        try:
            with conn.cursor() as cur:
                self._set_search_path(cur)
                cur.execute(
                    """UPDATE bulk_upload_job_items
                       SET status = 'pending', updated_at = CURRENT_TIMESTAMP
                       WHERE status = 'processing'"""
                )
                conn.commit()
        finally:
            conn.close()

    def reset_stuck_extracting_jobs(self):
        conn = get_db_connection()
        try:
            with conn.cursor() as cur:
                self._set_search_path(cur)
                cur.execute(
                    """UPDATE bulk_upload_jobs
                       SET status = 'failed', error_message = 'Server restarted during extraction. Please upload the zip file again.', updated_at = CURRENT_TIMESTAMP
                       WHERE status = 'extracting'"""
                )
                conn.commit()
        finally:
            conn.close()

    def get_pending_bulk_upload_job_items(self, limit: int = 1) -> List[Dict[str, Any]]:
        """Fetch one pending item at a time and mark as processing. Called by each parallel worker."""
        conn = get_db_connection()
        try:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                self._set_search_path(cur)
                cur.execute(
                    """SELECT i.* FROM bulk_upload_job_items i
                       JOIN bulk_upload_jobs j ON i.job_id = j.id
                       WHERE i.status = 'pending' AND j.status IN ('processing', 'pending', 'extracting')
                       ORDER BY i.created_at ASC
                       LIMIT %s FOR UPDATE SKIP LOCKED""",
                    (limit,)
                )
                rows = cur.fetchall()
                if rows:
                    item_ids = [r["id"] for r in rows]
                    cur.execute(
                        "UPDATE bulk_upload_job_items SET status = 'processing', updated_at = CURRENT_TIMESTAMP WHERE id = ANY(%s)",
                        (item_ids,)
                    )
                    conn.commit()
                return [dict(r) for r in rows]
        finally:
            conn.close()

    def get_active_bulk_upload_job(self) -> Optional[Dict[str, Any]]:
        conn = get_db_connection()
        try:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                self._set_search_path(cur)
                # Find the most recent job that hasn't completed, failed, or been cancelled
                cur.execute(
                    """SELECT * 
                       FROM bulk_upload_jobs 
                       WHERE status IN ('extracting', 'processing', 'paused')
                       ORDER BY created_at DESC
                       LIMIT 1"""
                )
                row = cur.fetchone()
                return dict(row) if row else None
        finally:
            conn.close()

    def pause_bulk_upload_job(self, job_id: int):
        conn = get_db_connection()
        try:
            with conn.cursor() as cur:
                self._set_search_path(cur)
                cur.execute(
                    "UPDATE bulk_upload_jobs SET status = 'paused', updated_at = CURRENT_TIMESTAMP WHERE id = %s",
                    (job_id,)
                )
                conn.commit()
                return True
        finally:
            conn.close()

    def resume_bulk_upload_job(self, job_id: int):
        conn = get_db_connection()
        try:
            with conn.cursor() as cur:
                self._set_search_path(cur)
                cur.execute(
                    "UPDATE bulk_upload_jobs SET status = 'processing', updated_at = CURRENT_TIMESTAMP WHERE id = %s",
                    (job_id,)
                )
                conn.commit()
                return True
        finally:
            conn.close()

    def get_bulk_upload_job_progress(self, job_id: int) -> Dict[str, Any]:
        conn = get_db_connection()
        try:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                self._set_search_path(cur)
                # Ensure we also aggregate any failed reasons
                cur.execute(
                    """SELECT status, COUNT(*) as count 
                       FROM bulk_upload_job_items 
                       WHERE job_id = %s 
                       GROUP BY status""",
                    (job_id,)
                )
                rows = cur.fetchall()
                
                cur.execute("SELECT * FROM bulk_upload_jobs WHERE id = %s", (job_id,))
                job = cur.fetchone()
                
                return {
                    "job": dict(job) if job else None,
                    "items_stats": [dict(r) for r in rows]
                }
        finally:
            conn.close()

    def retry_failed_bulk_upload_items(self, job_id: int) -> bool:
        """Mark all failed items for a job as pending so the workers pick them up again."""
        conn = get_db_connection()
        try:
            with conn.cursor() as cur:
                self._set_search_path(cur)
                # Reset items
                cur.execute(
                    """UPDATE bulk_upload_job_items
                       SET status = 'pending', error_message = NULL, updated_at = CURRENT_TIMESTAMP
                       WHERE job_id = %s AND status = 'failed'""",
                    (job_id,)
                )
                if cur.rowcount > 0:
                    # Reset job state back to processing
                    cur.execute(
                        """UPDATE bulk_upload_jobs
                           SET status = 'processing', updated_at = CURRENT_TIMESTAMP
                           WHERE id = %s""",
                        (job_id,)
                    )
                conn.commit()
                return True
        except Exception as e:
            logger.error(f"Failed to retry items for job {job_id}: {e}")
            return False
        finally:
            conn.close()

    def cancel_bulk_upload_job(self, job_id: int):
        conn = get_db_connection()
        try:
            with conn.cursor() as cur:
                self._set_search_path(cur)
                # Mark pending and processing items as cancelled, skipping any locked by active workers
                cur.execute("""
                    UPDATE bulk_upload_job_items 
                    SET status = 'cancelled' 
                    WHERE id IN (
                        SELECT id FROM bulk_upload_job_items 
                        WHERE job_id = %s AND status IN ('pending', 'processing')
                        FOR UPDATE SKIP LOCKED
                    )
                """, (job_id,))
                # Mark job as cancelled
                cur.execute("""
                    UPDATE bulk_upload_jobs 
                    SET status = 'cancelled' 
                    WHERE id = %s
                """, (job_id,))
            conn.commit()
            return True
        except Exception as e:
            conn.rollback()
            raise e
        finally:
            conn.close()

    def check_file_hash_exists(self, file_hash: str) -> bool:
        conn = get_db_connection()
        try:
            with conn.cursor() as cur:
                self._set_search_path(cur)
                cur.execute("SELECT 1 FROM bulk_upload_job_items WHERE file_hash = %s AND status = 'success' AND candidate_id IS NOT NULL LIMIT 1", (file_hash,))
                return cur.fetchone() is not None
        finally:
            conn.close()

    def create_offer(self, candidate_id: int, details: Dict[str, Any], content: Dict[str, Any]) -> int:
        conn = get_db_connection()
        try:
            with conn.cursor() as cur:
                self._set_search_path(cur)
                start_date = details.get("start_date")
                if start_date:
                    from datetime import datetime
                    try:
                        start_date = datetime.fromisoformat(start_date)
                    except:
                        pass
                cur.execute(
                    """INSERT INTO offer_letters 
                       (candidate_id, role_title, salary, department, location, start_date, offer_content, status)
                       VALUES (%s, %s, %s, %s, %s, %s, %s, 'pending') RETURNING id""",
                    (candidate_id, details.get("role_title"), details.get("salary"), details.get("department"), 
                     details.get("location"), start_date, json.dumps(content))
                )
                offer_id = cur.fetchone()[0]
                conn.commit()
                return offer_id
        finally:
            conn.close()

    def revert_employee(self, employee_id: int) -> bool:
        conn = get_db_connection()
        try:
            with conn.cursor() as cur:
                self._set_search_path(cur)
                cur.execute(
                    "UPDATE candidates SET status = 'New', updated_at = CURRENT_TIMESTAMP WHERE id = %s",
                    (employee_id,)
                )
                conn.commit()
                return cur.rowcount > 0
        finally:
            conn.close()

    def log_activity(self, candidate_id: int, actor_name: str, action: str, detail: str = None, conn=None, cur=None):
        should_close = False
        if conn is None:
            conn = get_db_connection()
            cur = conn.cursor()
            should_close = True
        try:
            self._set_search_path(cur)
            cur.execute('''
                INSERT INTO candidate_activity_log (candidate_id, actor_name, action, detail)
                VALUES (%s, %s, %s, %s)
            ''', (candidate_id, actor_name, action, detail))
            if should_close:
                conn.commit()
        except Exception as e:
            if should_close:
                conn.rollback()
            raise e
        finally:
            if should_close:
                cur.close()
                conn.close()

    def get_activity_log(self, candidate_id: int) -> List[Dict]:
        conn = get_db_connection()
        try:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                self._set_search_path(cur)
                cur.execute('''
                    SELECT * FROM candidate_activity_log WHERE candidate_id = %s ORDER BY created_at DESC
                ''', (candidate_id,))
                return [dict(r) for r in cur.fetchall()]
        finally:
            conn.close()

    def delete_candidate(self, candidate_id: int) -> bool:
        conn = get_db_connection()
        try:
            with conn.cursor() as cur:
                self._set_search_path(cur)
                # Remove reference from bulk_upload_job_items to prevent FK violations
                cur.execute("UPDATE bulk_upload_job_items SET candidate_id = NULL WHERE candidate_id = %s", (candidate_id,))
                
                # Dependencies (experience, education, notes, skills) should cascade delete 
                # based on the FK constraint ON DELETE CASCADE in schema.
                cur.execute("DELETE FROM candidates WHERE id = %s", (candidate_id,))
                conn.commit()
                return cur.rowcount > 0
        finally:
            conn.close()

    def bulk_delete_candidates(self, candidate_ids: List[int]) -> int:
        if not candidate_ids:
            return 0
        conn = get_db_connection()
        try:
            with conn.cursor() as cur:
                self._set_search_path(cur)
                # Remove reference from bulk_upload_job_items to prevent FK violations
                cur.execute("UPDATE bulk_upload_job_items SET candidate_id = NULL WHERE candidate_id = ANY(%s)", (candidate_ids,))
                
                # Delete candidates
                cur.execute("DELETE FROM candidates WHERE id = ANY(%s)", (candidate_ids,))
                conn.commit()
                return cur.rowcount
        finally:
            conn.close()

    def get_global_activity(self, limit: int = 10) -> List[Dict]:
        conn = get_db_connection()
        try:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                self._set_search_path(cur)
                cur.execute('''
                    SELECT a.id, a.candidate_id, c.full_name as candidate_name, 
                           a.actor_name, a.action, a.detail, a.created_at
                    FROM candidate_activity_log a
                    JOIN candidates c ON a.candidate_id = c.id
                    ORDER BY a.created_at DESC
                    LIMIT %s
                ''', (limit,))
                rows = cur.fetchall()
                results = []
                for r in rows:
                    d = dict(r)
                    if d.get("created_at"):
                        d["created_at"] = d["created_at"].isoformat()
                    results.append(d)
                return results
        finally:
            conn.close()

