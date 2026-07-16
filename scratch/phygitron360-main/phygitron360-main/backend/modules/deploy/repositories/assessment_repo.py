from typing import Dict, Any, List, Optional
from backend.core.database import get_db_connection
from psycopg2.extras import RealDictCursor

class AssessmentRepository:
    def _set_path(self, cur, tenant_id='public'):
        cur.execute(f'SET search_path TO "{tenant_id}", public')

    def get_employee_manager_name(self, employee_code: str, tenant_id: str = 'public') -> Optional[str]:
        conn = get_db_connection()
        try:
             with conn.cursor(cursor_factory=RealDictCursor) as cur:
                 self._set_path(cur, tenant_id)
                 cur.execute("SELECT name FROM employees WHERE employee_code = %s", (employee_code,))
                 row = cur.fetchone()
                 return row['name'] if row else None
        finally:
            conn.close()

    def get_employee_reporting_manager(self, employee_code: str, tenant_id: str = 'public') -> Optional[str]:
        conn = get_db_connection()
        try:
             with conn.cursor(cursor_factory=RealDictCursor) as cur:
                 self._set_path(cur, tenant_id)
                 cur.execute("SELECT reporting_manager FROM employees WHERE employee_code = %s", (employee_code,))
                 row = cur.fetchone()
                 return row['reporting_manager'] if row else None
        finally:
            conn.close()

    def get_assessments_meta(self, employee_code: str, year: int, tenant_id: str = 'public') -> List[Dict[str, Any]]:
        conn = get_db_connection()
        try:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                self._set_path(cur, tenant_id)
                cur.execute('''
                    SELECT * FROM quarterly_assessments 
                    WHERE employee_code = %s AND year = %s
                ''', (employee_code, year))
                rows = cur.fetchall()
                return [dict(r) for r in rows]
        finally:
            conn.close()

    def get_assessment_entries(self, assessment_id: int, tenant_id: str = 'public') -> List[Dict[str, Any]]:
        conn = get_db_connection()
        try:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                self._set_path(cur, tenant_id)
                cur.execute('''
                    SELECT category, subcategory, self_score, manager_score, score, manager_comment, employee_comment 
                    FROM assessment_entries WHERE assessment_id = %s
                ''', (assessment_id,))
                rows = cur.fetchall()
                return [dict(r) for r in rows]
        finally:
            conn.close()

    def upsert_assessment_header(self, employee_code: str, year: int, quarter: str, status: str, total_score: int, percentage: float, tenant_id: str = 'public') -> int:
        conn = get_db_connection()
        try:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                self._set_path(cur, tenant_id)
                # Check exist
                cur.execute('''
                    SELECT id FROM quarterly_assessments 
                    WHERE employee_code = %s AND year = %s AND quarter = %s
                ''', (employee_code, year, quarter))
                row = cur.fetchone()
                
                if row:
                    aid = row['id']
                    cur.execute('''
                        UPDATE quarterly_assessments 
                        SET status = %s, total_score = %s, percentage = %s, updated_at = CURRENT_TIMESTAMP
                        WHERE id = %s
                    ''', (status, total_score, percentage, aid))
                    conn.commit()
                    return aid
                else:
                    cur.execute('''
                        INSERT INTO quarterly_assessments (employee_code, year, quarter, status, total_score, percentage)
                        VALUES (%s, %s, %s, %s, %s, %s)
                        RETURNING id
                    ''', (employee_code, year, quarter, status, total_score, percentage))
                    conn.commit()
                    row = cur.fetchone()
                    return row['id']
        finally:
             conn.close()

    def replace_entries(self, assessment_id: int, entries: List[dict], tenant_id: str = 'public'):
        conn = get_db_connection()
        try:
            with conn.cursor() as cur:
                self._set_path(cur, tenant_id)
                cur.execute("DELETE FROM assessment_entries WHERE assessment_id = %s", (assessment_id,))
                for e in entries:
                    cur.execute('''
                        INSERT INTO assessment_entries (assessment_id, category, subcategory, self_score, manager_score, score, manager_comment, employee_comment)
                        VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                    ''', (
                        assessment_id, 
                        e.get('category'), e.get('subcategory'), 
                        e.get('self_score'), e.get('manager_score'), e.get('score'), 
                        e.get('manager_comment'), e.get('employee_comment')
                    ))
                conn.commit()
        finally:
            conn.close()

