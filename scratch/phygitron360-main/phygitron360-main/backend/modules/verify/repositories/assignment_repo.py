import json
from typing import Optional, List, Dict, Any
from backend.core.database import get_db_connection
from psycopg2.extras import RealDictCursor

class AssignmentRepository:
    def __init__(self, tenant_id: str = 'public'):
        self.tenant_id = tenant_id

    def _set_search_path(self, cur):
        cur.execute(f'SET search_path TO "{self.tenant_id}"')

    def get_user_assignments(self, user_id: int) -> List[Dict[str, Any]]:
        conn = get_db_connection()
        try:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                self._set_search_path(cur)
                cur.execute('''
                    SELECT
                        aa.id              AS assignment_id,
                        aa.assessment_id,
                        a.title,
                        a.description,
                        a.time_limit_minutes,
                        aa.deadline,
                        aa.status,
                        a.show_result_immediately,
                        aa.started_at,
                        aa.created_at      AS assigned_at
                    FROM assessment_assignments aa
                    JOIN assessments a ON a.id = aa.assessment_id
                    WHERE aa.user_id = %s
                      AND a.is_deleted = FALSE
                    ORDER BY aa.created_at DESC
                ''', (user_id,))
                return [dict(r) for r in cur.fetchall()]
        finally:
            conn.close()

    def get_assignment(self, asm_id: int, user_id: int) -> Optional[Dict[str, Any]]:
        conn = get_db_connection()
        try:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                self._set_search_path(cur)
                cur.execute(
                    "SELECT id, status FROM assessment_assignments WHERE assessment_id = %s AND user_id = %s",
                    (asm_id, user_id),
                )
                row = cur.fetchone()
                return dict(row) if row else None
        finally:
            conn.close()

    def update_assignment_status(self, asm_id: int, user_id: int, status: str, deadline: Optional[str] = None) -> None:
        conn = get_db_connection()
        try:
            with conn.cursor() as cur:
                self._set_search_path(cur)
                cur.execute(
                    """
                    UPDATE assessment_assignments
                    SET status = %s, deadline = COALESCE(%s, deadline), updated_at = CURRENT_TIMESTAMP
                    WHERE assessment_id = %s AND user_id = %s
                    """,
                    (status, deadline, asm_id, user_id),
                )
                conn.commit()
        finally:
            conn.close()

    def create_assignment(self, asm_id: int, user_id: int, assigned_by: int, deadline: Optional[str] = None) -> None:
        conn = get_db_connection()
        try:
            with conn.cursor() as cur:
                self._set_search_path(cur)
                cur.execute(
                    """
                    INSERT INTO assessment_assignments
                        (assessment_id, user_id, assigned_by, deadline, status)
                    VALUES (%s, %s, %s, %s, 'pending')
                    """,
                    (asm_id, user_id, assigned_by, deadline),
                )
                conn.commit()
        finally:
            conn.close()

    def get_assignment_candidates(self, asm_id: int) -> List[Dict[str, Any]]:
        conn = get_db_connection()
        try:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                self._set_search_path(cur)
                cur.execute(
                    """
                    SELECT
                        aa.id              AS assignment_id,
                        u.id               AS user_id,
                        e.name,
                        u.username         AS email,
                        aa.status,
                        aa.deadline,
                        aa.started_at,
                        aa.created_at      AS assigned_at
                    FROM assessment_assignments aa
                    JOIN users u ON u.id = aa.user_id
                    LEFT JOIN employees e ON e.employee_code = u.employee_code
                    WHERE aa.assessment_id = %s
                    ORDER BY aa.created_at DESC
                    """,
                    (asm_id,),
                )
                return [dict(r) for r in cur.fetchall()]
        finally:
            conn.close()

    def update_custom_questions(self, asm_id: int, user_id: int, custom_questions: List[Dict[str, Any]]) -> None:
        conn = get_db_connection()
        try:
            with conn.cursor() as cur:
                self._set_search_path(cur)
                cur.execute(
                    """
                    UPDATE assessment_assignments
                    SET custom_questions = %s, updated_at = CURRENT_TIMESTAMP
                    WHERE assessment_id = %s AND user_id = %s
                    """,
                    (json.dumps(custom_questions), asm_id, user_id),
                )
                conn.commit()
        finally:
            conn.close()

    def start_session(self, asm_id: int, user_id: int) -> bool:
        conn = get_db_connection()
        try:
            with conn.cursor() as cur:
                self._set_search_path(cur)
                cur.execute(
                    """
                    UPDATE assessment_assignments
                    SET status = 'in_progress', started_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
                    WHERE assessment_id = %s AND user_id = %s AND status = 'pending'
                    RETURNING id
                    """,
                    (asm_id, user_id)
                )
                row = cur.fetchone()
                conn.commit()
                return bool(row)
        finally:
            conn.close()

    def record_strike(self, asm_id: int, user_id: int, max_strikes: int = 5) -> Dict[str, Any]:
        conn = get_db_connection()
        try:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                self._set_search_path(cur)
                cur.execute(
                    """
                    UPDATE assessment_assignments
                    SET strike_count = strike_count + 1,
                        updated_at = CURRENT_TIMESTAMP,
                        terminated_by_proctor = CASE WHEN strike_count + 1 >= %s THEN TRUE ELSE FALSE END,
                        status = CASE WHEN strike_count + 1 >= %s THEN 'terminated' ELSE status END
                    WHERE assessment_id = %s AND user_id = %s
                    RETURNING strike_count, terminated_by_proctor
                    """,
                    (max_strikes, max_strikes, asm_id, user_id)
                )
                row = cur.fetchone()
                conn.commit()
                return dict(row) if row else {"strike_count": 0, "terminated_by_proctor": False}
        finally:
            conn.close()
