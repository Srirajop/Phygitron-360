import json
from typing import Optional, List, Dict, Any
from backend.core.database import get_db_connection
from psycopg2.extras import RealDictCursor
from datetime import datetime

class AssessmentRepository:
    def __init__(self, tenant_id: str = 'public'):
        self.tenant_id = tenant_id

    def _set_search_path(self, cur):
        cur.execute(f'SET search_path TO "{self.tenant_id}"')

    def create_assessment(self, data: Dict[str, Any]) -> int:
        conn = get_db_connection()
        try:
            with conn.cursor() as cur:
                self._set_search_path(cur)
                cur.execute('''
                    INSERT INTO assessments 
                    (title, description, type, time_limit_minutes, pass_score, 
                     shuffle_questions, show_result_immediately, created_by, status, is_deleted, org_id)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                    RETURNING id
                ''', (
                    data.get("title"),
                    data.get("description"),
                    data.get("type", "mcq"),
                    data.get("time_limit_minutes"),
                    data.get("pass_score", 70.0),
                    data.get("shuffle_questions", False),
                    data.get("show_result_immediately", True),
                    data.get("created_by"),
                    data.get("status", "draft"),
                    False,
                    data.get("org_id")
                ))
                asm_id = cur.fetchone()[0]
                
                # Create Questions
                for q in data.get("questions", []):
                    cur.execute('''
                        INSERT INTO assessment_questions 
                        (assessment_id, question_text, question_type, options, correct_answer, 
                         model_answer, starter_code, test_cases, programming_language, 
                         accepted_file_types, skill_id, marks, order_index)
                        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                    ''', (
                        asm_id,
                        q.get("question_text"),
                        q.get("question_type"),
                        json.dumps(q.get("options", [])),
                        q.get("correct_answer"),
                        q.get("model_answer"),
                        q.get("starter_code"),
                        json.dumps(q.get("test_cases", [])),
                        q.get("programming_language"),
                        q.get("accepted_file_types"),
                        q.get("skill_id"),
                        q.get("marks", 1.0),
                        q.get("order_index", 0)
                    ))
                
                conn.commit()
                return asm_id
        finally:
            conn.close()

    def get_assessment_by_id(self, asm_id: int) -> Optional[Dict[str, Any]]:
        conn = get_db_connection()
        try:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                self._set_search_path(cur)
                cur.execute("SELECT * FROM assessments WHERE id = %s AND is_deleted = FALSE", (asm_id,))
                row = cur.fetchone()
                if not row:
                    return None
                
                result = dict(row)
                cur.execute("SELECT * FROM assessment_questions WHERE assessment_id = %s ORDER BY order_index", (asm_id,))
                result['questions'] = [dict(r) for r in cur.fetchall()]
                return result
        finally:
            conn.close()

    def get_all_assessments(self) -> List[Dict[str, Any]]:
        conn = get_db_connection()
        try:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                self._set_search_path(cur)
                cur.execute('''
                    SELECT a.*, COUNT(q.id) AS question_count
                    FROM assessments a
                    LEFT JOIN assessment_questions q ON q.assessment_id = a.id
                    WHERE a.is_deleted = FALSE
                    GROUP BY a.id
                    ORDER BY a.created_at DESC
                ''')
                return [dict(r) for r in cur.fetchall()]
        finally:
            conn.close()

    def update_assessment(self, asm_id: int, updates: Dict[str, Any]) -> bool:
        if not updates:
            return True
        conn = get_db_connection()
        try:
            with conn.cursor() as cur:
                self._set_search_path(cur)
                set_clauses = ", ".join(f"{k} = %s" for k in updates)
                values = list(updates.values()) + [asm_id]
                cur.execute(
                    f"UPDATE assessments SET {set_clauses}, updated_at = CURRENT_TIMESTAMP WHERE id = %s AND is_deleted = FALSE",
                    values,
                )
                conn.commit()
                return cur.rowcount > 0
        finally:
            conn.close()

    def delete_assessment(self, asm_id: int) -> bool:
        conn = get_db_connection()
        try:
            with conn.cursor() as cur:
                self._set_search_path(cur)
                cur.execute(
                    "UPDATE assessments SET is_deleted = TRUE, updated_at = CURRENT_TIMESTAMP WHERE id = %s",
                    (asm_id,),
                )
                conn.commit()
                return cur.rowcount > 0
        finally:
            conn.close()

    def update_assessment_status(self, asm_id: int, status: str) -> bool:
        conn = get_db_connection()
        try:
            with conn.cursor() as cur:
                self._set_search_path(cur)
                cur.execute("UPDATE assessments SET status = %s, updated_at = CURRENT_TIMESTAMP WHERE id = %s AND is_deleted = FALSE", (status, asm_id))
                conn.commit()
                return cur.rowcount > 0
        finally:
            conn.close()

    def get_assignment_status(self, user_id: int, assessment_id: int) -> Optional[Dict[str, Any]]:
        conn = get_db_connection()
        try:
            with conn.cursor() as cur:
                self._set_search_path(cur)
                cur.execute('''
                    INSERT INTO assessment_assignments (assessment_id, user_id, assigned_by, deadline)
                    VALUES (%s, %s, %s, %s)
                    RETURNING id
                ''', (assessment_id, user_id, assigned_by, deadline))
                asm_id = cur.fetchone()[0]
                conn.commit()
                return asm_id
        finally:
            conn.close()

    def get_user_assignments(self, user_id: int) -> List[Dict[str, Any]]:
        conn = get_db_connection()
        try:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                self._set_search_path(cur)
                cur.execute('''
                    SELECT a.*, asm.title, asm.type, asm.time_limit_minutes, asm.pass_score
                    FROM assessment_assignments a
                    JOIN assessments asm ON a.assessment_id = asm.id
                    WHERE a.user_id = %s
                    ORDER BY a.created_at DESC
                ''', (user_id,))
                return [dict(r) for r in cur.fetchall()]
        finally:
            conn.close()

    def get_results_by_assessment(self, asm_id: int) -> List[Dict[str, Any]]:
        conn = get_db_connection()
        try:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                self._set_search_path(cur)
                cur.execute('''
                    SELECT r.*, u.username as user_name
                    FROM assessment_results r
                    JOIN users u ON r.user_id = u.id
                    WHERE r.assessment_id = %s
                    ORDER BY r.score DESC
                ''', (asm_id,))
                return [dict(r) for r in cur.fetchall()]
        finally:
            conn.close()

    def get_result_by_id(self, result_id: int) -> Optional[Dict[str, Any]]:
        conn = get_db_connection()
        try:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                self._set_search_path(cur)
                cur.execute("SELECT * FROM assessment_results WHERE id = %s", (result_id,))
                row = cur.fetchone()
                if not row: return None
                result = dict(row)
                
                cur.execute("SELECT * FROM proctoring_flags WHERE assessment_result_id = %s", (result_id,))
                result['flags'] = [dict(r) for r in cur.fetchall()]
                return result
        finally:
            conn.close()
