from typing import List, Dict, Any, Optional
import json
from backend.core.database import get_db_connection
from psycopg2.extras import RealDictCursor

class EmployeeRepository:
    def _set_path(self, cur, tenant_id='public'):
        cur.execute(f'SET search_path TO "{tenant_id}", public')

    def get_all_employees_basic(self, tenant_id: str = 'public') -> List[Dict[str, Any]]:
        conn = get_db_connection()
        try:
            cur = conn.cursor(cursor_factory=RealDictCursor)
            self._set_path(cur, tenant_id)
            cur.execute("""
                SELECT e.employee_code, e.name, e.designation, e.team, e.reporting_manager, e.email_id, 
                       e.photo_path, e.employment_status, e.exit_date, e.doj, e.location, e.employment_type,
                       MAX(u.role) as role
                FROM employees e
                LEFT JOIN users u ON e.employee_code = u.employee_code
                GROUP BY e.employee_code, e.name, e.designation, e.team, e.reporting_manager, e.email_id, 
                         e.photo_path, e.employment_status, e.exit_date, e.doj, e.location, e.employment_type
            """)
            rows = cur.fetchall()
            return [dict(row) for row in rows]
        finally:
            conn.close()

    def get_employee_by_code(self, employee_code: str, tenant_id: str = 'public') -> Optional[Dict[str, Any]]:
        conn = get_db_connection()
        try:
            cur = conn.cursor(cursor_factory=RealDictCursor)
            self._set_path(cur, tenant_id)
            cur.execute("""
                SELECT e.*, u.role
                FROM employees e
                LEFT JOIN users u ON e.employee_code = u.employee_code
                WHERE e.employee_code = %s
            """, (employee_code,))
            row = cur.fetchone()
            return dict(row) if row else None
        finally:
            conn.close()

    def get_employee_by_email(self, email_id: str, tenant_id: str = 'public') -> Optional[Dict[str, Any]]:
        conn = get_db_connection()
        try:
            cur = conn.cursor(cursor_factory=RealDictCursor)
            self._set_path(cur, tenant_id)
            cur.execute("""
                SELECT e.*, u.role
                FROM employees e
                LEFT JOIN users u ON e.employee_code = u.employee_code
                WHERE e.email_id = %s
            """, (email_id,))
            row = cur.fetchone()
            return dict(row) if row else None
        finally:
            conn.close()

    def get_skill_matrix(self, employee_code: str, tenant_id: str = 'public') -> Optional[Dict[str, Any]]:
        conn = get_db_connection()
        try:
             cur = conn.cursor(cursor_factory=RealDictCursor)
             self._set_path(cur, tenant_id)
             cur.execute("SELECT * FROM skill_matrix WHERE employee_code = %s", (employee_code,))
             row = cur.fetchone()
             return dict(row) if row else {}
        finally:
            conn.close()

    def get_assets(self, employee_code: str, tenant_id: str = 'public') -> List[Dict[str, Any]]:
        conn = get_db_connection()
        try:
            cur = conn.cursor(cursor_factory=RealDictCursor)
            self._set_path(cur, tenant_id)
            cur.execute("SELECT * FROM assets WHERE employee_code = %s", (employee_code,))
            rows = cur.fetchall()
            return [dict(r) for r in rows]
        finally:
            conn.close()

    def get_performance(self, employee_code: str, tenant_id: str = 'public') -> List[Dict[str, Any]]:
        conn = get_db_connection()
        try:
            cur = conn.cursor(cursor_factory=RealDictCursor)
            self._set_path(cur, tenant_id)
            cur.execute("SELECT * FROM performance WHERE employee_code = %s", (employee_code,))
            rows = cur.fetchall()
            return [dict(r) for r in rows]
        finally:
            conn.close()

    def get_hr_activity(self, employee_code: str, tenant_id: str = 'public') -> List[Dict[str, Any]]:
        conn = get_db_connection()
        try:
            cur = conn.cursor(cursor_factory=RealDictCursor)
            self._set_path(cur, tenant_id)
            cur.execute("SELECT * FROM hr_activity WHERE employee_code = %s", (employee_code,))
            rows = cur.fetchall()
            return [dict(r) for r in rows]
        finally:
            conn.close()

    def get_assessments(self, employee_code: str, tenant_id: str = 'public') -> List[Dict[str, Any]]:
        conn = get_db_connection()
        try:
            cur = conn.cursor(cursor_factory=RealDictCursor)
            self._set_path(cur, tenant_id)
            cur.execute("""
                SELECT 
                    id,
                    year,
                    period_type,
                    period_value,
                    status,
                    total_score,
                    percentage,
                    updated_at
                FROM performance_assessments
                WHERE employee_code = %s
                ORDER BY year DESC, created_at DESC
            """, (employee_code,))
            rows = cur.fetchall()
            return [dict(r) for r in rows]
        except Exception:
            return []
        finally:
            conn.close()

    def create_employee(self, data: Dict[str, Any], tenant_id: str = 'public'):
        conn = get_db_connection()
        try:
            cur = conn.cursor()
            self._set_path(cur, tenant_id)
            cur.execute('''
                INSERT INTO employees (
                    employee_code, name, dob, contact_number, emergency_contact, email_id, doj, 
                    team, designation, employment_type, reporting_manager, location, 
                    current_address, permanent_address, education_details,
                    pf_included, mediclaim_included, 
                    photo_path, cv_path, id_proofs, notes, 
                    bank_name, bank_account_no, pan_no,
                    employment_status
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            ''', (
                data['code'], data['name'], data['dob'], data['phone'], data['emergency'], 
                data['email'], data['doj'], data['team'], data.get('designation', ''), data['type'], 
                data['manager'], data['location'], data['current_address'], data['permanent_address'],
                json.dumps(data.get('education_details', [])),
                data['pf'], data['mediclaim'], 
                data['photo_path'], data['cv_path'], data['id_proofs'], data['notes'],
                data.get('bank_name'), data.get('bank_account_no'), data.get('pan_no'),
                data.get('employment_status', 'Active')
            ))
            
            # Skill Matrix
            cur.execute('''
                INSERT INTO skill_matrix (
                    employee_code, candidate_name, primary_skillset,
                    secondary_skillset, experience_years, cv_upload
                ) VALUES (%s, %s, %s, %s, %s, %s)
            ''', (
                data['code'], data['name'], data['primary_skillset'], data['secondary_skillset'],
                data['experience_years'], data['cv_path']
            ))
            
            conn.commit()
        finally:
            conn.close()

    def update_employee_rehire(self, old_employee_code: str, data: Dict[str, Any], tenant_id: str = 'public'):
        conn = get_db_connection()
        try:
            cur = conn.cursor()
            self._set_path(cur, tenant_id)
            cur.execute('''
                UPDATE employees
                SET employee_code = %s,
                    name = %s,
                    dob = %s,
                    contact_number = %s,
                    emergency_contact = %s,
                    doj = %s,
                    team = %s,
                    designation = %s,
                    employment_type = %s,
                    reporting_manager = %s,
                    location = %s,
                    current_address = %s,
                    permanent_address = %s,
                    education_details = %s,
                    pf_included = %s,
                    mediclaim_included = %s,
                    photo_path = %s,
                    cv_path = %s,
                    id_proofs = %s,
                    notes = %s,
                    bank_name = %s,
                    bank_account_no = %s,
                    pan_no = %s,
                    employment_status = %s,
                    exit_date = NULL,
                    exit_reason = NULL,
                    clearance_status = NULL
                WHERE employee_code = %s
            ''', (
                data['code'], data['name'], data['dob'], data['phone'], data['emergency'], 
                data['doj'], data['team'], data.get('designation', ''), data['type'], 
                data['manager'], data['location'], data['current_address'], data['permanent_address'],
                json.dumps(data.get('education_details', [])),
                data['pf'], data['mediclaim'], 
                data['photo_path'], data['cv_path'], data['id_proofs'], data['notes'],
                data.get('bank_name'), data.get('bank_account_no'), data.get('pan_no'),
                data.get('employment_status', 'Active'),
                old_employee_code
            ))
            
            cur.execute('''
                UPDATE skill_matrix
                SET candidate_name = %s, primary_skillset = %s, secondary_skillset = %s, experience_years = %s, cv_upload = %s
                WHERE employee_code = %s
            ''', (
                data['name'], data['primary_skillset'], data['secondary_skillset'],
                data['experience_years'], data['cv_path'], data['code']
            ))
            conn.commit()
        finally:
            conn.close()

    def update_employee_fields(self, employee_code: str, fields: List[str], values: List[Any], tenant_id: str = 'public'):
        conn = get_db_connection()
        try:
            cur = conn.cursor()
            self._set_path(cur, tenant_id)
            values.append(employee_code)
            query = f"UPDATE employees SET {', '.join([f'{f} = %s' for f in fields])} WHERE employee_code = %s"
            
            # Ensure all values are psycopg2-friendly
            safe_values = []
            for v in values:
                if isinstance(v, (dict, list)):
                    safe_values.append(json.dumps(v))
                else:
                    safe_values.append(v)
                    
            cur.execute(query, tuple(safe_values))
            conn.commit()
        finally:
            conn.close()

    def update_user_role(self, employee_code: str, role: str, tenant_id: str = 'public'):
        conn = get_db_connection()
        try:
            cur = conn.cursor(cursor_factory=RealDictCursor)
            self._set_path(cur, tenant_id)
            # First verify user exists for this employee
            cur.execute("SELECT id FROM users WHERE employee_code = %s", (employee_code,))
            user = cur.fetchone()
            if user:
                cur.execute("UPDATE users SET role = %s WHERE employee_code = %s", (role, employee_code))
                conn.commit()
        finally:
            conn.close()

    def update_skill_matrix(self, employee_code: str, primary: str, secondary: str, tenant_id: str = 'public', experience_years: Any = None):
        conn = get_db_connection()
        try:
            cur = conn.cursor(cursor_factory=RealDictCursor)
            self._set_path(cur, tenant_id)
            # Check exist
            cur.execute("SELECT id FROM skill_matrix WHERE employee_code = %s", (employee_code,))
            exists = cur.fetchone()
            if exists:
                updates = []
                vals = []
                if primary is not None:
                    updates.append("primary_skillset = %s")
                    vals.append(primary)
                if secondary is not None:
                    updates.append("secondary_skillset = %s")
                    vals.append(secondary)
                if experience_years is not None:
                    updates.append("experience_years = %s")
                    vals.append(str(experience_years))
                
                if updates:
                    vals.append(employee_code)
                    query = f"UPDATE skill_matrix SET {', '.join(updates)} WHERE employee_code = %s"
                    cur.execute(query, tuple(vals))
            else:
                cur.execute("INSERT INTO skill_matrix (employee_code, primary_skillset, secondary_skillset, experience_years) VALUES (%s, %s, %s, %s)", 
                          (employee_code, primary or '', secondary or '', str(experience_years or '0')))
            conn.commit()
        finally:
            conn.close()

    def delete_employee_cascade(self, employee_code: str, tenant_id: str = 'public'):
        conn = get_db_connection()
        try:
            cur = conn.cursor()
            self._set_path(cur, tenant_id)
            cur.execute("DELETE FROM skill_matrix WHERE employee_code = %s", (employee_code,))
            cur.execute("DELETE FROM assets WHERE employee_code = %s", (employee_code,))
            cur.execute("DELETE FROM performance WHERE employee_code = %s", (employee_code,))
            cur.execute("DELETE FROM hr_activity WHERE employee_code = %s", (employee_code,))
            cur.execute("DELETE FROM employees WHERE employee_code = %s", (employee_code,))
            conn.commit()
        finally:
            conn.close()

    def get_dropdown_options(self, tenant_id: str = 'public') -> Dict[str, Any]:
        conn = get_db_connection()
        try:
            cur = conn.cursor()
            self._set_path(cur, tenant_id)
            cur.execute("SELECT DISTINCT team FROM employees WHERE team IS NOT NULL AND team != '' ORDER BY team")
            teams = [r[0] for r in cur.fetchall()]
            
            cur.execute("SELECT DISTINCT designation FROM employees WHERE designation IS NOT NULL AND designation != '' ORDER BY designation")
            designations = [r[0] for r in cur.fetchall()]

            cur.execute("SELECT DISTINCT location FROM employees WHERE location IS NOT NULL AND location != '' ORDER BY location")
            locations = [r[0] for r in cur.fetchall()]
            
            cur.execute("""
                SELECT e.name, u.employee_code, u.role
                FROM employees e
                JOIN users u ON e.employee_code = u.employee_code
                WHERE u.role IN ('org_admin', 'manager', 'super_admin')
                ORDER BY e.name
            """)
            managers = [{"name": r[0], "code": r[1], "role": r[2]} for r in cur.fetchall()]
            
            return {
                "teams": teams, 
                "designations": designations, 
                "managers": managers,
                "locations": locations
            }
        finally:
             conn.close()

    def offboard_employee(self, employee_code: str, exit_date: str, exit_reason: str, status: str = 'Exited', deactivate: bool = True, tenant_id: str = 'public'):
        conn = get_db_connection()
        try:
            cur = conn.cursor()
            self._set_path(cur, tenant_id)
            cur.execute("""
                UPDATE employees 
                SET employment_status = %s, 
                    exit_date = %s, 
                    exit_reason = %s,
                    clearance_status = 'Pending'
                WHERE employee_code = %s
            """, (status, exit_date, exit_reason, employee_code))
            
            if deactivate:
                cur.execute("UPDATE users SET is_active = 0, role = 'trainee', roles = ARRAY['trainee']::varchar[] WHERE employee_code = %s", (employee_code,))
            
            conn.commit()
        finally:
            conn.close()

