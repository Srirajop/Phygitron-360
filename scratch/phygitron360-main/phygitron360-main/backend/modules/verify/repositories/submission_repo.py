import json
from typing import Optional, List, Dict, Any
from backend.core.database import get_db_connection
from psycopg2.extras import RealDictCursor

class SubmissionRepository:
    def __init__(self, tenant_id: str = 'public'):
        self.tenant_id = tenant_id

    def _set_search_path(self, cur):
        cur.execute(f'SET search_path TO "{self.tenant_id}"')

    def create_result(self, data: Dict[str, Any]) -> int:
        conn = get_db_connection()
        try:
            with conn.cursor() as cur:
                self._set_search_path(cur)
                cur.execute('''
                    INSERT INTO assessment_results 
                        (assessment_id, user_id, answers, score, pass_status, feedback,
                         is_malpractice, time_taken_seconds, submitted_at)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, CURRENT_TIMESTAMP)
                    RETURNING id
                ''', (
                    data.get("assessment_id"),
                    data.get("user_id"),
                    json.dumps(data.get("answers")),
                    data.get("initial_score"),
                    data.get("pass_status"),
                    data.get("initial_feedback"),
                    data.get("is_malpractice"),
                    data.get("time_taken_seconds"),
                ))
                res_id = cur.fetchone()[0]
                
                # Update assignment status
                cur.execute('''
                    UPDATE assessment_assignments 
                    SET status = %s, updated_at = CURRENT_TIMESTAMP
                    WHERE user_id = %s AND assessment_id = %s
                ''', (data.get("assignment_status", "submitted"), data.get("user_id"), data.get("assessment_id")))
                
                # Add Proctoring Flags
                for flag in data.get("proctoring_events", []):
                    cur.execute('''
                        INSERT INTO proctoring_flags (assessment_result_id, flag_type, details)
                        VALUES (%s, %s, %s)
                    ''', (res_id, flag.get("type"), json.dumps(flag.get("details", {}))))

                conn.commit()
                return res_id
        finally:
            conn.close()

    def update_result_grading(self, result_id: int, assessment_id: int, user_id: int, scores_per_q: Dict, pct_score: float, passed: bool, feedback_str: str) -> None:
        # Extract weak_skill_ids from feedback JSON
        weak_skill_ids = []
        try:
            fb = json.loads(feedback_str)
            weak_skill_ids = fb.get("weak_skill_ids", [])
        except Exception:
            pass

        conn = get_db_connection()
        try:
            with conn.cursor() as cur:
                self._set_search_path(cur)
                cur.execute(
                    """
                    UPDATE assessment_results
                    SET scores_per_question = %s,
                        score = %s,
                        pass_status = %s,
                        feedback = %s,
                        weak_skill_ids = %s,
                        updated_at = CURRENT_TIMESTAMP
                    WHERE id = %s
                    """,
                    (json.dumps(scores_per_q), pct_score, passed, feedback_str, json.dumps(weak_skill_ids), result_id),
                )
                cur.execute(
                    """
                    UPDATE assessment_assignments
                    SET status = 'graded', updated_at = CURRENT_TIMESTAMP
                    WHERE assessment_id = %s AND user_id = %s
                    """,
                    (assessment_id, user_id),
                )

                # Forge auto-enrollment for weak skills
                if weak_skill_ids:
                    # Find any active forge_courses that target these weak skills
                    cur.execute("SELECT id, target_skill_ids FROM forge_courses WHERE is_active = TRUE")
                    courses = cur.fetchall()
                    for course in courses:
                        course_id = course[0]
                        target_skills = course[1] or []
                        if any(ws in target_skills for ws in weak_skill_ids):
                            # Check if already enrolled
                            cur.execute(
                                "SELECT 1 FROM forge_enrollments WHERE user_id = %s AND course_id = %s",
                                (user_id, course_id)
                            )
                            if not cur.fetchone():
                                cur.execute(
                                    """
                                    INSERT INTO forge_enrollments (user_id, course_id, enrolled_by)
                                    VALUES (%s, %s, %s)
                                    """,
                                    (user_id, course_id, 'auto_remediation')
                                )
                
                # Deploy auto-updates (Certificates & Skill Matrix)
                if passed:
                    cur.execute("SELECT employee_code, full_name FROM users LEFT JOIN candidates ON candidates.user_id = users.id WHERE users.id = %s", (user_id,))
                    u_row = cur.fetchone()
                    if u_row and u_row[0]:
                        emp_code = u_row[0]
                        candidate_name = u_row[1] or "Employee"
                        cur.execute("SELECT title FROM assessments WHERE id = %s", (assessment_id,))
                        asm_row = cur.fetchone()
                        asm_title = asm_row[0] if asm_row else f"Assessment {assessment_id}"
                        
                        # 1. Update Skill Matrix
                        cur.execute(
                            """
                            INSERT INTO skill_matrix (employee_code, primary_skillset)
                            VALUES (%s, %s)
                            """,
                            (emp_code, f"{asm_title} Certified")
                        )
                        
                        # 2. Generate PDF Certificate
                        try:
                            from backend.modules.verify.services.certificate_generator import generate_certificate
                            cert_path = generate_certificate(candidate_name, asm_title, pct_score, result_id)
                            cur.execute(
                                """
                                INSERT INTO employee_documents (employee_code, document_type, document_name, file_path, uploaded_by)
                                VALUES (%s, %s, %s, %s, %s)
                                """,
                                (emp_code, 'Certificate', f"{asm_title} Certificate", cert_path, 'Auto-Grader')
                            )
                        except Exception as cert_err:
                            import logging
                            logging.getLogger(__name__).warning(f"Failed to generate certificate: {cert_err}")

                conn.commit()
        finally:
            conn.close()

    def get_results_by_assessment(self, asm_id: int) -> List[Dict[str, Any]]:
        conn = get_db_connection()
        try:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                self._set_search_path(cur)
                cur.execute('''
                    SELECT r.*, u.username as user_name, u.id as user_id, e.name as display_name
                    FROM assessment_results r
                    JOIN users u ON r.user_id = u.id
                    LEFT JOIN employees e ON e.employee_code = u.employee_code
                    WHERE r.assessment_id = %s
                    ORDER BY r.score DESC NULLS LAST
                ''', (asm_id,))
                return [dict(r) for r in cur.fetchall()]
        finally:
            conn.close()

    def get_result_by_id(self, result_id: int) -> Optional[Dict[str, Any]]:
        conn = get_db_connection()
        try:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                self._set_search_path(cur)
                cur.execute('''
                    SELECT r.*, a.show_result_immediately 
                    FROM assessment_results r 
                    JOIN assessments a ON a.id = r.assessment_id 
                    WHERE r.id = %s
                ''', (result_id,))
                row = cur.fetchone()
                if not row: return None
                result = dict(row)
                
                cur.execute("SELECT * FROM proctoring_flags WHERE assessment_result_id = %s", (result_id,))
                result['flags'] = [dict(r) for r in cur.fetchall()]
                return result
        finally:
            conn.close()

    def get_leaderboard(self, asm_id: int) -> List[Dict[str, Any]]:
        conn = get_db_connection()
        try:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                self._set_search_path(cur)
                cur.execute(
                    """
                    SELECT u.id as user_id, e.name as user_name, u.username as email,
                           r.score, r.pass_status, r.time_taken_seconds
                    FROM assessment_results r
                    JOIN users u ON u.id = r.user_id
                    LEFT JOIN employees e ON e.employee_code = u.employee_code
                    WHERE r.assessment_id = %s AND r.score IS NOT NULL
                    ORDER BY r.score DESC, r.time_taken_seconds ASC
                    LIMIT 50
                    """,
                    (asm_id,),
                )
                return [dict(r) for r in cur.fetchall()]
        finally:
            conn.close()

    def get_my_results(self, user_id: int) -> List[Dict[str, Any]]:
        conn = get_db_connection()
        try:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                self._set_search_path(cur)
                cur.execute(
                    """
                    SELECT
                        r.id           AS result_id,
                        r.assessment_id,
                        a.title,
                        a.show_result_immediately,
                        r.score,
                        r.pass_status,
                        r.submitted_at,
                        r.is_malpractice,
                        r.feedback
                    FROM assessment_results r
                    JOIN assessments a ON a.id = r.assessment_id
                    WHERE r.user_id = %s
                    ORDER BY r.submitted_at DESC
                    """,
                    (user_id,),
                )
                rows = []
                for r in cur.fetchall():
                    row = dict(r)
                    feedback_str = row.get("feedback") or "{}"
                    try:
                        feedback_json = json.loads(feedback_str) if isinstance(feedback_str, str) else feedback_str
                    except:
                        feedback_json = {}
                    is_released = feedback_json.get("_is_released", False)
                    
                    if not row.get("show_result_immediately") and not is_released:
                        row["score"] = None
                        row["pass_status"] = None
                        row["feedback"] = None
                        
                    # Don't send full feedback in list API anyway
                    if "feedback" in row:
                        del row["feedback"]
                        
                    rows.append(row)
                return rows
        finally:
            conn.close()

    def update_result_feedback(self, result_id: int, feedback: str) -> bool:
        conn = get_db_connection()
        try:
            with conn.cursor() as cur:
                self._set_search_path(cur)
                cur.execute(
                    "UPDATE assessment_results SET feedback = %s, updated_at = CURRENT_TIMESTAMP WHERE id = %s",
                    (feedback, result_id),
                )
                conn.commit()
                return cur.rowcount > 0
        finally:
            conn.close()

    def get_assessment_analytics(self, asm_id: int) -> Dict[str, Any]:
        conn = get_db_connection()
        try:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                self._set_search_path(cur)
                cur.execute(
                    """
                    SELECT
                        COUNT(id) AS total_submissions,
                        AVG(score) AS average_score,
                        COUNT(CASE WHEN pass_status = true THEN 1 END) AS passed_count,
                        COUNT(CASE WHEN is_malpractice = true THEN 1 END) AS malpractice_count
                    FROM assessment_results
                    WHERE assessment_id = %s
                    """,
                    (asm_id,),
                )
                row = cur.fetchone()
                return dict(row) if row else {}
        finally:
            conn.close()
