from typing import List, Optional, Dict, Any
from backend.core.database import get_db_connection
from psycopg2.extras import RealDictCursor

class AttendanceRepository:
    def _set_path(self, cur, tenant_id='public'):
        cur.execute(f'SET search_path TO "{tenant_id}", public')

    def is_reporting_manager(self, employee_code: str, tenant_id: str = 'public') -> bool:
        if not employee_code:
            return False
        conn = get_db_connection()
        try:
            cur = conn.cursor()
            self._set_path(cur, tenant_id)
            cur.execute("SELECT 1 FROM employees WHERE reporting_manager = %s LIMIT 1", (employee_code,))
            return bool(cur.fetchone())
        finally:
            conn.close()

    def get_todays_attendance(self, employee_code: str, date: str, tenant_id: str = 'public') -> Optional[Dict[str, Any]]:
        conn = get_db_connection()
        try:
            cur = conn.cursor(cursor_factory=RealDictCursor)
            self._set_path(cur, tenant_id)
            cur.execute(
                "SELECT * FROM attendance WHERE employee_code = %s AND date = %s", 
                (employee_code, date)
            )
            row = cur.fetchone()
            return dict(row) if row else None
        finally:
            conn.close()

    def clock_in(self, employee_code: str, date: str, time: str, ip: str, tenant_id: str = 'public'):
        conn = get_db_connection()
        try:
            cur = conn.cursor()
            self._set_path(cur, tenant_id)
            cur.execute('''
                INSERT INTO attendance (employee_code, date, clock_in, ip_address, status)
                VALUES (%s, %s, %s, %s, 'Active')
            ''', (employee_code, date, time, ip))
            conn.commit()
        finally:
            conn.close()

    def clock_out(self, employee_code: str, date: str, time: str, work_log: str, tenant_id: str = 'public'):
        conn = get_db_connection()
        try:
            cur = conn.cursor()
            self._set_path(cur, tenant_id)
            cur.execute('''
                UPDATE attendance 
                SET clock_out = %s, work_log = %s, status = 'Present'
                WHERE employee_code = %s AND date = %s
            ''', (time, work_log, employee_code, date))
            conn.commit()
        finally:
            conn.close()

    def upsert_attendance(self, employee_code: str, date: str, clock_in: Optional[str], clock_out: Optional[str], work_log: Optional[str], status: str, tenant_id: str = 'public'):
        conn = get_db_connection()
        try:
            cur = conn.cursor()
            self._set_path(cur, tenant_id)
            cur.execute('''
                INSERT INTO attendance (employee_code, date, clock_in, clock_out, work_log, status)
                VALUES (%s, %s, %s, %s, %s, %s)
                ON CONFLICT (employee_code, date) DO UPDATE 
                SET clock_in = EXCLUDED.clock_in,
                    clock_out = EXCLUDED.clock_out,
                    work_log = EXCLUDED.work_log,
                    status = EXCLUDED.status
            ''', (employee_code, date, clock_in, clock_out, work_log, status))
            conn.commit()
        finally:
            conn.close()

    def get_history(self, employee_code: str, limit: int = 30, tenant_id: str = 'public') -> List[Dict[str, Any]]:
        conn = get_db_connection()
        try:
            cur = conn.cursor(cursor_factory=RealDictCursor)
            self._set_path(cur, tenant_id)
            cur.execute('''
                SELECT * FROM attendance 
                WHERE employee_code = %s 
                ORDER BY date DESC LIMIT %s
            ''', (employee_code, limit))
            records = cur.fetchall()
            return [dict(r) for r in records]
        finally:
            conn.close()

    def get_leave_balance(self, employee_code: str, year: int, tenant_id: str = 'public') -> Optional[Dict[str, Any]]:
        conn = get_db_connection()
        try:
            cur = conn.cursor(cursor_factory=RealDictCursor)
            self._set_path(cur, tenant_id)
            cur.execute(
                "SELECT * FROM leave_balances WHERE employee_code = %s AND year = %s",
                (employee_code, year)
            )
            row = cur.fetchone()
            return dict(row) if row else None
        finally:
            conn.close()

    def create_leave_balance(self, employee_code: str, year: int, tenant_id: str = 'public'):
        conn = get_db_connection()
        try:
            cur = conn.cursor()
            self._set_path(cur, tenant_id)
            cur.execute(
                "INSERT INTO leave_balances (employee_code, year) VALUES (%s, %s)",
                (employee_code, year)
            )
            conn.commit()
        finally:
            conn.close()
    
    def update_leave_balance(self, employee_code: str, used_delta: float, extended_delta: float, tenant_id: str = 'public'):
        conn = get_db_connection()
        try:
            cur = conn.cursor()
            self._set_path(cur, tenant_id)
            cur.execute('''
                UPDATE leave_balances 
                SET used_leaves = used_leaves + %s,
                    extended_leaves = extended_leaves + %s
                WHERE employee_code = %s
            ''', (used_delta, extended_delta, employee_code))
            conn.commit()
        finally:
            conn.close()

    def create_leave_request(self, employee_code: str, start: str, end: str, duration_days: float, start_day_type: str, end_day_type: str, l_type: str, reason: str, status: str = 'Pending', tenant_id: str = 'public'):
        conn = get_db_connection()
        try:
            cur = conn.cursor()
            self._set_path(cur, tenant_id)
            cur.execute('''
                INSERT INTO leaves (employee_code, start_date, end_date, duration_days, start_day_type, end_day_type, leave_type, reason, status)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
            ''', (employee_code, start, end, duration_days, start_day_type, end_day_type, l_type, reason, status))
            conn.commit()
        finally:
            conn.close()

    def get_employee_leaves(self, employee_code: str, tenant_id: str = 'public') -> List[Dict[str, Any]]:
        conn = get_db_connection()
        try:
            cur = conn.cursor(cursor_factory=RealDictCursor)
            self._set_path(cur, tenant_id)
            cur.execute(
                "SELECT * FROM leaves WHERE employee_code = %s ORDER BY applied_at DESC", 
                (employee_code,)
            )
            leaves = cur.fetchall()
            return [dict(l) for l in leaves]
        finally:
            conn.close()

    def get_all_pending_leaves(self, admin_role: str, admin_code: Optional[str], tenant_id: str = 'public') -> List[Dict[str, Any]]:
        conn = get_db_connection()
        try:
            cur = conn.cursor(cursor_factory=RealDictCursor)
            self._set_path(cur, tenant_id)
            query = '''
                SELECT l.*, e.name as employee_name, COALESCE(u.role, 'Employee') as applicant_role
                FROM leaves l 
                JOIN employees e ON l.employee_code = e.employee_code 
                LEFT JOIN users u ON l.employee_code = u.employee_code
                WHERE l.status = 'Pending'
            '''
            params = []
            
            # Manager should only see pending leaves for their direct reports
            if admin_role == 'manager' and admin_code:
                query += " AND e.reporting_manager = %s"
                params.append(admin_code)
            
            # Approvers should not see their own leave in the approval queue
            if admin_code:
                query += " AND l.employee_code != %s"
                params.append(admin_code)
                
            query += " ORDER BY l.applied_at ASC"
            
            cur.execute(query, params)
            leaves = cur.fetchall()
            return [dict(l) for l in leaves]
        finally:
            conn.close()
            
    def get_leave_by_id(self, leave_id: int, tenant_id: str = 'public') -> Optional[Dict[str, Any]]:
        conn = get_db_connection()
        try:
            cur = conn.cursor(cursor_factory=RealDictCursor)
            self._set_path(cur, tenant_id)
            cur.execute("SELECT * FROM leaves WHERE id = %s", (leave_id,))
            row = cur.fetchone()
            return dict(row) if row else None
        finally:
            conn.close()

    def update_leave_status(self, leave_id: int, status: str, reason: Optional[str], tenant_id: str = 'public'):
        conn = get_db_connection()
        try:
            cur = conn.cursor()
            self._set_path(cur, tenant_id)
            cur.execute("UPDATE leaves SET status = %s, rejection_reason = %s WHERE id = %s", (status, reason, leave_id))
            conn.commit()
        finally:
            conn.close()

    def get_daily_log(self, date: str, manager_code: Optional[str] = None, tenant_id: str = 'public') -> List[Dict[str, Any]]:
        conn = get_db_connection()
        try:
            cur = conn.cursor(cursor_factory=RealDictCursor)
            self._set_path(cur, tenant_id)
            if manager_code:
                cur.execute('''
                    SELECT a.*, e.name as employee_name, e.designation 
                    FROM attendance a
                    JOIN employees e ON a.employee_code = e.employee_code 
                    WHERE a.date = %s AND e.reporting_manager = %s
                ''', (date, manager_code))
            else:
                cur.execute('''
                    SELECT a.*, e.name as employee_name, e.designation 
                    FROM attendance a
                    JOIN employees e ON a.employee_code = e.employee_code 
                    WHERE a.date = %s
                ''', (date,))
            logs = cur.fetchall()
            return [dict(l) for l in logs]
        finally:
            conn.close()

    def get_monthly_attendance(self, start_date: str, end_date: str, tenant_id: str = 'public') -> List[Dict[str, Any]]:
        conn = get_db_connection()
        try:
             cur = conn.cursor(cursor_factory=RealDictCursor)
             self._set_path(cur, tenant_id)
             cur.execute("""
                SELECT employee_code, date, status, clock_in, clock_out
                FROM attendance 
                WHERE date BETWEEN %s AND %s
            """, (start_date, end_date))
             rows = cur.fetchall()
             return [dict(r) for r in rows]
        finally:
            conn.close()

    def get_monthly_approved_leaves(self, start_date: str, end_date: str, tenant_id: str = 'public') -> List[Dict[str, Any]]:
        conn = get_db_connection()
        try:
            cur = conn.cursor(cursor_factory=RealDictCursor)
            self._set_path(cur, tenant_id)
            cur.execute("""
                SELECT employee_code, start_date, end_date, leave_type, duration_days, start_day_type, end_day_type
                FROM leaves 
                WHERE status = 'Approved' 
                AND NOT (end_date < %s OR start_date > %s)
            """, (start_date, end_date))
            rows = cur.fetchall()
            return [dict(r) for r in rows]
        finally:
            conn.close()
            
    def get_all_active_employees_basic(self, tenant_id: str = 'public') -> List[Dict[str, Any]]:
        conn = get_db_connection()
        try:
            cur = conn.cursor(cursor_factory=RealDictCursor)
            self._set_path(cur, tenant_id)
            cur.execute("SELECT name, employee_code FROM employees WHERE employment_status = 'Active' ORDER BY name")
            rows = cur.fetchall()
            return [dict(r) for r in rows]
        finally:
            conn.close()

    def get_user_role(self, employee_code: str, tenant_id: str = 'public') -> Optional[str]:
        conn = get_db_connection()
        try:
            cur = conn.cursor(cursor_factory=RealDictCursor)
            self._set_path(cur, tenant_id)
            cur.execute("SELECT role FROM users WHERE employee_code = %s", (employee_code,))
            row = cur.fetchone()
            return row['role'] if row else None
        finally:
            conn.close()

    def mark_past_missed_clockouts_as_absent(self, current_date: str, tenant_id: str = 'public'):
        """Bulk update past-day records with missing clock-outs to 'Absent' status."""
        conn = get_db_connection()
        try:
            cur = conn.cursor()
            self._set_path(cur, tenant_id)
            cur.execute('''
                UPDATE attendance 
                SET status = 'Absent' 
                WHERE date < %s AND clock_in IS NOT NULL AND clock_out IS NULL AND status = 'Active'
            ''', (current_date,))
            conn.commit()
        finally:
            conn.close()

    def get_unclosed_attendance_records(self, tenant_id: str = 'public') -> List[Dict[str, Any]]:
        """Fetch all attendance records for active employees with clock-in but no clock-out."""
        conn = get_db_connection()
        try:
            cur = conn.cursor(cursor_factory=RealDictCursor)
            self._set_path(cur, tenant_id)
            cur.execute('''
                SELECT a.id, a.employee_code, a.date, a.clock_in, e.name as employee_name, e.email_id as employee_email
                FROM attendance a
                JOIN employees e ON a.employee_code = e.employee_code
                LEFT JOIN attendance_reminders r ON a.id = r.attendance_id
                WHERE a.clock_in IS NOT NULL AND a.clock_out IS NULL
                  AND a.status IN ('Active', 'Absent')
                  AND e.employment_status = 'Active'
                  AND a.date >= TO_CHAR(CURRENT_DATE - INTERVAL '14 days', 'YYYY-MM-DD')
                  AND (r.reminder_count IS NULL OR r.reminder_count < 5)
            ''')
            rows = cur.fetchall()
            return [dict(row) for row in rows]
        finally:
            conn.close()

    def get_attendance_reminder(self, attendance_id: int, tenant_id: str = 'public') -> Optional[Dict[str, Any]]:
        """Retrieve the reminder log for a specific attendance record."""
        conn = get_db_connection()
        try:
            cur = conn.cursor(cursor_factory=RealDictCursor)
            self._set_path(cur, tenant_id)
            cur.execute(
                "SELECT * FROM attendance_reminders WHERE attendance_id = %s",
                (attendance_id,)
            )
            row = cur.fetchone()
            return dict(row) if row else None
        finally:
            conn.close()

    def upsert_attendance_reminder(self, attendance_id: int, employee_code: str, last_sent_at: Any, tenant_id: str = 'public'):
        """Log or increment the reminder count in the reminders tracking table."""
        conn = get_db_connection()
        try:
            cur = conn.cursor()
            self._set_path(cur, tenant_id)
            cur.execute('''
                INSERT INTO attendance_reminders (attendance_id, employee_code, last_reminder_sent, reminder_count)
                VALUES (%s, %s, %s, 1)
                ON CONFLICT (attendance_id) DO UPDATE
                SET last_reminder_sent = EXCLUDED.last_reminder_sent,
                    reminder_count = attendance_reminders.reminder_count + 1
            ''', (attendance_id, employee_code, last_sent_at))
            conn.commit()
        finally:
            conn.close()

    def update_attendance_status(self, attendance_id: int, status: str, tenant_id: str = 'public'):
        """Update the status of an attendance record."""
        conn = get_db_connection()
        try:
            cur = conn.cursor()
            self._set_path(cur, tenant_id)
            cur.execute('''
                UPDATE attendance
                SET status = %s
                WHERE id = %s
            ''', (status, attendance_id))
            conn.commit()
        finally:
            conn.close()

    def create_attendance_correction(self, attendance_id: Optional[int], employee_code: str, date: str, clock_in: Optional[str], clock_out: Optional[str], reason: str, tenant_id: str = 'public'):
        conn = get_db_connection()
        try:
            cur = conn.cursor()
            self._set_path(cur, tenant_id)
            cur.execute('''
                INSERT INTO attendance_corrections (attendance_id, employee_code, date, clock_in, clock_out, reason, status)
                VALUES (%s, %s, %s, %s, %s, %s, 'Pending')
            ''', (attendance_id, employee_code, date, clock_in, clock_out, reason))
            conn.commit()
        finally:
            conn.close()

    def get_pending_corrections(self, manager_code: Optional[str], tenant_id: str = 'public') -> List[Dict[str, Any]]:
        conn = get_db_connection()
        try:
            cur = conn.cursor(cursor_factory=RealDictCursor)
            self._set_path(cur, tenant_id)
            if manager_code:
                cur.execute('''
                    SELECT ac.*, e.name as employee_name
                    FROM attendance_corrections ac
                    JOIN employees e ON ac.employee_code = e.employee_code
                    WHERE ac.status = 'Pending' AND e.reporting_manager = %s
                ''', (manager_code,))
            else:
                cur.execute('''
                    SELECT ac.*, e.name as employee_name
                    FROM attendance_corrections ac
                    JOIN employees e ON ac.employee_code = e.employee_code
                    WHERE ac.status = 'Pending'
                ''')
            rows = cur.fetchall()
            return [dict(row) for row in rows]
        finally:
            conn.close()

    def get_correction_by_id(self, correction_id: int, tenant_id: str = 'public') -> Optional[Dict[str, Any]]:
        conn = get_db_connection()
        try:
            cur = conn.cursor(cursor_factory=RealDictCursor)
            self._set_path(cur, tenant_id)
            cur.execute("SELECT * FROM attendance_corrections WHERE id = %s", (correction_id,))
            row = cur.fetchone()
            return dict(row) if row else None
        finally:
            conn.close()

    def update_correction_status(self, correction_id: int, status: str, approved_by: Optional[str], rejection_reason: Optional[str] = None, tenant_id: str = 'public'):
        conn = get_db_connection()
        try:
            cur = conn.cursor()
            self._set_path(cur, tenant_id)
            cur.execute('''
                UPDATE attendance_corrections
                SET status = %s, approved_by = %s, approved_at = CURRENT_TIMESTAMP, rejection_reason = %s
                WHERE id = %s
            ''', (status, approved_by, rejection_reason, correction_id))
            conn.commit()
        finally:
            conn.close()

    def clear_reminders_for_attendance(self, attendance_id: int, tenant_id: str = 'public'):
        conn = get_db_connection()
        try:
            cur = conn.cursor()
            self._set_path(cur, tenant_id)
            cur.execute("DELETE FROM attendance_reminders WHERE attendance_id = %s", (attendance_id,))
            conn.commit()
        finally:
            conn.close()

    def get_manager_code(self, employee_code: str, tenant_id: str = 'public') -> Optional[str]:
        conn = get_db_connection()
        try:
            cur = conn.cursor()
            self._set_path(cur, tenant_id)
            cur.execute(
                "SELECT reporting_manager FROM employees WHERE employee_code = %s",
                (employee_code,)
            )
            row = cur.fetchone()
            return row[0] if row else None
        finally:
            conn.close()

    def get_employee_email(self, employee_code: str, tenant_id: str = 'public') -> Optional[str]:
        conn = get_db_connection()
        try:
            cur = conn.cursor()
            self._set_path(cur, tenant_id)
            cur.execute(
                "SELECT email_id FROM employees WHERE employee_code = %s",
                (employee_code,)
            )
            row = cur.fetchone()
            return row[0] if row else None
        finally:
            conn.close()

    def get_employee_name(self, employee_code: str, tenant_id: str = 'public') -> Optional[str]:
        conn = get_db_connection()
        try:
            cur = conn.cursor()
            self._set_path(cur, tenant_id)
            cur.execute(
                "SELECT name FROM employees WHERE employee_code = %s",
                (employee_code,)
            )
            row = cur.fetchone()
            return row[0] if row else None
        finally:
            conn.close()

    def get_employees_for_reporting(self, manager_code: Optional[str], tenant_id: str = 'public') -> List[Dict[str, Any]]:
        conn = get_db_connection()
        try:
            cur = conn.cursor(cursor_factory=RealDictCursor)
            self._set_path(cur, tenant_id)
            if manager_code:
                cur.execute('''
                    SELECT employee_code, name, email_id, reporting_manager, employment_status
                    FROM employees
                    WHERE reporting_manager = %s AND employment_status = 'Active'
                ''', (manager_code,))
            else:
                cur.execute('''
                    SELECT employee_code, name, email_id, reporting_manager, employment_status
                    FROM employees
                    WHERE employment_status = 'Active'
                ''')
            rows = cur.fetchall()
            return [dict(row) for row in rows]
        finally:
            conn.close()

    def check_overlapping_leaves(self, employee_code: str, start_date: str, end_date: str, tenant_id: str = 'public') -> bool:
        conn = get_db_connection()
        try:
            cur = conn.cursor()
            self._set_path(cur, tenant_id)
            cur.execute('''
                SELECT id FROM leaves
                WHERE employee_code = %s AND status != 'Rejected'
                  AND NOT (end_date < %s OR start_date > %s)
            ''', (employee_code, start_date, end_date))
            row = cur.fetchone()
            return row is not None
        finally:
            conn.close()

    def get_all_managers(self, tenant_id: str = 'public') -> List[str]:
        conn = get_db_connection()
        try:
            cur = conn.cursor()
            self._set_path(cur, tenant_id)
            cur.execute("SELECT DISTINCT reporting_manager FROM employees WHERE reporting_manager IS NOT NULL AND reporting_manager != ''")
            rows = cur.fetchall()
            return [row[0] for row in rows]
        finally:
            conn.close()

    def get_pending_correction_for_date(self, employee_code: str, date: str, tenant_id: str = 'public') -> Optional[Dict[str, Any]]:
        conn = get_db_connection()
        try:
            cur = conn.cursor(cursor_factory=RealDictCursor)
            self._set_path(cur, tenant_id)
            cur.execute(
                "SELECT * FROM attendance_corrections WHERE employee_code = %s AND date = %s AND status = 'Pending'",
                (employee_code, date)
            )
            row = cur.fetchone()
            return dict(row) if row else None
        finally:
            conn.close()
