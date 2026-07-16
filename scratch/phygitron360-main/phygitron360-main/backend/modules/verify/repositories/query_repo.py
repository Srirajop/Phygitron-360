import json
from datetime import datetime
from typing import Optional, List, Dict, Any
from backend.core.database import get_db_connection
from psycopg2.extras import RealDictCursor

class QueryRepository:
    def __init__(self, tenant_id: str = 'public'):
        self.tenant_id = tenant_id

    def _set_search_path(self, cur):
        cur.execute(f'SET search_path TO "{self.tenant_id}"')

    def get_queries(self, status: Optional[str] = None) -> List[Dict[str, Any]]:
        conn = get_db_connection()
        try:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                self._set_search_path(cur)
                query = """
                    SELECT q.*,
                           a.title AS assessment_title,
                           u.name AS candidate_name,
                           u.email AS candidate_email
                    FROM assessment_queries q
                    LEFT JOIN assessments a ON a.id = q.assessment_id
                    LEFT JOIN users u ON u.id = q.user_id
                """
                params = []
                if status:
                    query += " WHERE q.status = %s"
                    params.append(status)
                query += " ORDER BY q.created_at DESC"
                cur.execute(query, params)
                return [dict(r) for r in cur.fetchall()]
        finally:
            conn.close()

    def create_query(self, data: Dict[str, Any]) -> int:
        conn = get_db_connection()
        try:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                self._set_search_path(cur)

                cur.execute(
                    "SELECT id, assessment_id FROM assessment_results WHERE id = %s AND user_id = %s",
                    (data["assessment_result_id"], data["user_id"]),
                )
                result_row = cur.fetchone()
                if not result_row:
                    raise ValueError("Result not found or you do not own this result")

                cur.execute(
                    """
                    INSERT INTO assessment_queries
                        (assessment_id, assessment_result_id, user_id, subject, message, status, created_at, updated_at)
                    VALUES (%s, %s, %s, %s, %s, 'open', %s, %s)
                    RETURNING id
                    """,
                    (
                        result_row["assessment_id"],
                        data["assessment_result_id"],
                        data["user_id"],
                        data.get("subject"),
                        data["message"],
                        datetime.utcnow(),
                        datetime.utcnow(),
                    ),
                )
                new_id = cur.fetchone()["id"]
                conn.commit()
                return new_id
        finally:
            conn.close()

    def update_query(self, query_id: int, updates: Dict[str, Any]) -> bool:
        if not updates:
            return True
            
        conn = get_db_connection()
        try:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                self._set_search_path(cur)
                
                updates["updated_at"] = datetime.utcnow()
                set_clause = ", ".join(f"{k} = %s" for k in updates)
                
                cur.execute(
                    f"UPDATE assessment_queries SET {set_clause} WHERE id = %s",
                    list(updates.values()) + [query_id],
                )
                conn.commit()
                return cur.rowcount > 0
        finally:
            conn.close()

    def get_my_queries(self, user_id: int) -> List[Dict[str, Any]]:
        conn = get_db_connection()
        try:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                self._set_search_path(cur)
                cur.execute(
                    """
                    SELECT q.*, a.title AS assessment_title
                    FROM assessment_queries q
                    LEFT JOIN assessments a ON a.id = q.assessment_id
                    WHERE q.user_id = %s
                    ORDER BY q.created_at DESC
                    """,
                    (user_id,),
                )
                return [dict(r) for r in cur.fetchall()]
        finally:
            conn.close()
