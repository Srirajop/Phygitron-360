import json
from typing import List, Optional, Dict, Any
from backend.core.database import get_db_connection
from psycopg2.extras import RealDictCursor

class PerformanceRepository:
    def _set_path(self, cur, tenant_id='public'):
        cur.execute(f'SET search_path TO "{tenant_id}", public')

    def get_employee_reporting_manager(self, employee_code: str, tenant_id: str = 'public') -> Optional[str]:
        conn = get_db_connection()
        try:
            cur = conn.cursor(cursor_factory=RealDictCursor)
            self._set_path(cur, tenant_id)
            cur.execute("SELECT reporting_manager FROM employees WHERE employee_code = %s", (employee_code,))
            row = cur.fetchone()
            return row['reporting_manager'] if row else None
        finally:
            conn.close()

    def save_assessment(self, data: Dict[str, Any], tenant_id: str = 'public') -> Dict[str, Any]:
        conn = get_db_connection()
        try:
            cur = conn.cursor(cursor_factory=RealDictCursor)
            self._set_path(cur, tenant_id)
            
            # Check if exists - strictly filter by tenant_id to avoid schema cross-talk
            cur.execute('''
                SELECT id FROM performance_assessments 
                WHERE employee_code = %s AND year = %s AND period_type = %s AND period_value = %s
                AND (tenant_id = %s OR tenant_id IS NULL)
            ''', (data['employee_code'], data['year'], data['period_type'], data['period_value'], tenant_id))
            existing = cur.fetchone()
            
            if existing:
                cur.execute('''
                    UPDATE performance_assessments 
                    SET status = %s, entries = %s, total_score = %s, percentage = %s, updated_at = CURRENT_TIMESTAMP
                    WHERE id = %s
                    RETURNING *
                ''', (data['status'], json.dumps(data['entries']), data['total_score'], data['percentage'], existing['id']))
            else:
                cur.execute('''
                    INSERT INTO performance_assessments 
                    (employee_code, year, period_type, period_value, status, entries, total_score, percentage, tenant_id)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                    RETURNING *
                ''', (
                    data['employee_code'], data['year'], data['period_type'], data['period_value'],
                    data['status'], json.dumps(data['entries']), data['total_score'], data['percentage'], tenant_id
                ))
            
            row = cur.fetchone()
            conn.commit()
            return dict(row) if row else {}
        except Exception as e:
            raise e
        finally:
            conn.close()

    def get_assessments(self, employee_code: str, year: int, tenant_id: str = 'public') -> List[Dict[str, Any]]:
        conn = get_db_connection()
        try:
            cur = conn.cursor(cursor_factory=RealDictCursor)
            self._set_path(cur, tenant_id)
            cur.execute('''
                SELECT * FROM performance_assessments 
                WHERE employee_code = %s AND year = %s AND (tenant_id = %s OR tenant_id IS NULL)
                ORDER BY created_at DESC
            ''', (employee_code, year, tenant_id))
            rows = cur.fetchall()
            return [dict(r) for r in rows]
        finally:
            conn.close()

    def get_assessment_by_id(self, assessment_id: int, tenant_id: str = 'public') -> Optional[Dict[str, Any]]:
        conn = get_db_connection()
        try:
            cur = conn.cursor(cursor_factory=RealDictCursor)
            self._set_path(cur, tenant_id)
            cur.execute("SELECT * FROM performance_assessments WHERE id = %s", (assessment_id,))
            row = cur.fetchone()
            return dict(row) if row else None
        finally:
            conn.close()
