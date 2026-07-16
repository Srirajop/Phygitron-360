import json
from typing import Optional, List, Dict, Any
from backend.core.database import get_db_connection
from psycopg2.extras import RealDictCursor

class QuestionBankRepository:
    def __init__(self, tenant_id: str = 'public'):
        self.tenant_id = tenant_id

    def _set_search_path(self, cur):
        cur.execute(f'SET search_path TO "{self.tenant_id}"')

    def create_question(self, data: Dict[str, Any]) -> int:
        conn = get_db_connection()
        try:
            with conn.cursor() as cur:
                self._set_search_path(cur)
                cur.execute('''
                    INSERT INTO question_bank (
                        question_text, question_type, options, correct_answer,
                        model_answer, starter_code, test_cases, programming_language,
                        accepted_file_types, marks, tags, images, created_by
                    ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                    RETURNING id
                ''', (
                    data["question_text"],
                    data.get("question_type", "mcq"),
                    json.dumps(data.get("options", [])),
                    data.get("correct_answer"),
                    data.get("model_answer"),
                    data.get("starter_code"),
                    json.dumps(data.get("test_cases", [])),
                    data.get("programming_language"),
                    data.get("accepted_file_types"),
                    data.get("marks", 1.0),
                    json.dumps(data.get("tags", [])),
                    json.dumps(data.get("images", [])),
                    data.get("created_by")
                ))
                new_id = cur.fetchone()[0]
                conn.commit()
                return new_id
        finally:
            conn.close()

    def update_question(self, question_id: int, data: Dict[str, Any]) -> bool:
        conn = get_db_connection()
        try:
            with conn.cursor() as cur:
                self._set_search_path(cur)
                
                updates = []
                values = []
                for field in ["question_text", "question_type", "correct_answer", "model_answer", 
                              "starter_code", "programming_language", "accepted_file_types", "marks"]:
                    if field in data:
                        updates.append(f"{field} = %s")
                        values.append(data[field])
                        
                for json_field in ["options", "test_cases", "tags", "images"]:
                    if json_field in data:
                        updates.append(f"{json_field} = %s")
                        values.append(json.dumps(data[json_field]))
                        
                if not updates:
                    return False
                    
                updates_str = ", ".join(updates)
                values.append(question_id)
                
                cur.execute(f'''
                    UPDATE question_bank 
                    SET {updates_str}
                    WHERE id = %s AND is_deleted = FALSE
                ''', tuple(values))
                conn.commit()
                return cur.rowcount > 0
        finally:
            conn.close()

    def delete_question(self, question_id: int) -> bool:
        conn = get_db_connection()
        try:
            with conn.cursor() as cur:
                self._set_search_path(cur)
                cur.execute('''
                    UPDATE question_bank 
                    SET is_deleted = TRUE 
                    WHERE id = %s
                ''', (question_id,))
                conn.commit()
                return cur.rowcount > 0
        finally:
            conn.close()

    def list_questions(self, tags: Optional[List[str]] = None, q_type: Optional[str] = None) -> List[Dict[str, Any]]:
        conn = get_db_connection()
        try:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                self._set_search_path(cur)
                query = "SELECT * FROM question_bank WHERE is_deleted = FALSE"
                params = []
                
                if q_type:
                    query += " AND question_type = %s"
                    params.append(q_type)
                    
                if tags:
                    query += " AND tags ?| array[%s]"
                    params.append(tags) # Postgres JSONB ?| operator checks if any of the given array strings exist as top-level keys/elements
                    
                query += " ORDER BY created_at DESC"
                cur.execute(query, tuple(params))
                return [dict(row) for row in cur.fetchall()]
        finally:
            conn.close()
