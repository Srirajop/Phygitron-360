import pandas as pd
from typing import Dict, Any, List, Optional
from backend.core.database import get_db_connection
from psycopg2.extras import RealDictCursor

class DashboardRepository:
    def _read_sql_as_df(self, query: str, conn):
        """Helper to read SQL directly into a DataFrame using raw cursor to avoid pandas warnings."""
        with conn.cursor() as cur:
            cur.execute(query)
            columns = [desc[0] for desc in cur.description]
            data = cur.fetchall()
            return pd.DataFrame(data, columns=columns)

    def get_all_counts(self, tenant_id: str = 'public') -> Dict[str, Any]:
        """Fetch raw dataframes for analytics."""
        conn = get_db_connection()
        try:
            # Set search path on the connection itself
            with conn.cursor() as cur:
                cur.execute(f'SET search_path TO "{tenant_id}", public')
            
            return {
                "employees": self._read_sql_as_df("SELECT * FROM employees", conn),
                "assets": self._read_sql_as_df("SELECT * FROM assets", conn),
                "skills": self._read_sql_as_df("SELECT * FROM skill_matrix", conn), 
                "candidates": self._read_sql_as_df("SELECT * FROM candidates", conn),
                "job_roles": self._read_sql_as_df("SELECT * FROM job_roles", conn),
                "notifications": self._read_sql_as_df("SELECT * FROM notifications WHERE employee_code IS NULL OR type = 'AdminAlert' ORDER BY created_at DESC LIMIT 5", conn),
            }
        finally:
            conn.close()


    def get_employee_dashboard_data(self, employee_code: str, tenant_id: str = 'public') -> Dict[str, Any]:
        conn = get_db_connection()
        try:
            result = {}
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute(f'SET search_path TO "{tenant_id}"')
                # 1. Employee Details
                cur.execute("SELECT * FROM employees WHERE employee_code = %s", (employee_code,))
                emp = cur.fetchone()
                result['employee'] = dict(emp) if emp else {}

                # 2. Performance (KRAs)
                cur.execute("""
                    SELECT count(*)::int as total, 
                           COALESCE(sum(case when status = 'Completed' then 1 else 0 end), 0)::int as completed
                    FROM kra_assignments 
                    WHERE employee_code = %s
                """, (employee_code,))
                res = cur.fetchone()
                result['kras'] = dict(res) if res else {"total": 0, "completed": 0}
                
                # 3. Training (HR Activity counts)
                cur.execute("""
                    SELECT count(*)::int as total,
                           COALESCE(sum(case when training_status = 'Completed' then 1 else 0 end), 0)::int as completed
                    FROM hr_activity
                    WHERE employee_code = %s
                """, (employee_code,))
                res = cur.fetchone()
                result['training'] = dict(res) if res else {"total": 0, "completed": 0}
                
                # 4. Assets
                cur.execute("""
                    SELECT 
                        (ob_laptop + ob_laptop_bag + ob_headphones + ob_mouse + ob_extra_hardware + ob_client_assets) as total_assigned
                    FROM assets 
                    WHERE employee_code = %s
                """, (employee_code,))
                asset_row = cur.fetchone()
                result['asset_count'] = asset_row['total_assigned'] if asset_row and asset_row['total_assigned'] else 0
                
                # 5. Notifications
                cur.execute("""
                    SELECT * FROM notifications 
                    WHERE employee_code = %s 
                    ORDER BY created_at DESC 
                    LIMIT 5
                """, (employee_code,))
                notifs = cur.fetchall()
                result['notifications'] = [dict(n) for n in notifs]
                
                # 6. Attendance Today - Cast CURRENT_DATE to TEXT to match types
                cur.execute("SELECT 1 FROM attendance WHERE employee_code = %s AND date = CAST(CURRENT_DATE AS TEXT)", (employee_code,))
                att = cur.fetchone()
                result['attendance_status'] = "Present" if att else "Absent"
                
                # 7. Leaves - Cast EXTRACT result to INT to match year column
                cur.execute("SELECT 0 as sick_used, 0 as sick_total, used_leaves as casual_used, total_leaves as casual_total FROM leave_balances WHERE employee_code = %s AND year = CAST(EXTRACT(YEAR FROM CURRENT_DATE) AS INTEGER)", (employee_code,))
                balance = cur.fetchone()
                result['leaves'] = dict(balance) if balance else {"sick_used": 0, "sick_total": 0, "casual_used": 0, "casual_total": 0}

                # 8. Attendance History (For current year trends)
                cur.execute("""
                    SELECT date, clock_in, clock_out, status, work_log 
                    FROM attendance 
                    WHERE employee_code = %s 
                      AND date >= CAST(EXTRACT(YEAR FROM CURRENT_DATE) AS TEXT) || '-01-01'
                    ORDER BY date DESC
                """, (employee_code,))
                att_history = cur.fetchall()
                result['attendance_history'] = [dict(a) for a in att_history]

                # 9. Recent Leaves (Detailed list for the leaves bar chart/timeline)
                cur.execute("""
                    SELECT start_date, end_date, leave_type, status, reason, applied_at
                    FROM leaves
                    WHERE employee_code = %s
                    ORDER BY applied_at DESC, start_date DESC
                    LIMIT 10
                """, (employee_code,))
                rec_leaves = cur.fetchall()
                result['recent_leaves'] = []
                for leaf in rec_leaves:
                    d = dict(leaf)
                    if d.get('applied_at'):
                        d['applied_at'] = d['applied_at'].isoformat()
                    result['recent_leaves'].append(d)

                # 10. Latest Performance Assessment
                cur.execute("""
                    SELECT year, period_type, period_value, status, percentage
                    FROM performance_assessments
                    WHERE employee_code = %s
                    ORDER BY year DESC, created_at DESC
                    LIMIT 1
                """, (employee_code,))
                latest_p = cur.fetchone()
                result['latest_performance'] = dict(latest_p) if latest_p else None

                # 11. Performance History (For plotting trend lines/area charts)
                cur.execute("""
                    SELECT year, period_type, period_value, status, percentage
                    FROM performance_assessments
                    WHERE employee_code = %s
                    ORDER BY year ASC, created_at ASC
                """, (employee_code,))
                p_history = cur.fetchall()
                result['performance_history'] = [dict(p) for p in p_history]

                # 12. Training List (For training progress chart)
                cur.execute("""
                    SELECT program_id, training_assigned as training_name, training_status, training_date, training_duration
                    FROM hr_activity
                    WHERE employee_code = %s
                    ORDER BY id DESC
                    LIMIT 10
                """, (employee_code,))
                t_list = cur.fetchall()
                result['training_list'] = [dict(t) for t in t_list]
            
            return result
        finally:
            conn.close()

