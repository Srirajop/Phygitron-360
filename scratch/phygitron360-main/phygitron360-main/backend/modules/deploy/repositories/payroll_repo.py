from typing import List, Optional, Dict, Any
from backend.core.database import get_db_connection
from psycopg2.extras import RealDictCursor


class PayrollRepository:
    def _set_path(self, cur, tenant_id='public'):
        cur.execute(f'SET search_path TO "{tenant_id}", public')

    def upsert_payroll_record(self, data: dict, tenant_id: str = 'public'):
        conn = get_db_connection()
        try:
            cur = conn.cursor()
            self._set_path(cur, tenant_id)
            cur.execute('''
                INSERT INTO payroll_records (
                    employee_code, pay_month, pay_year, pay_date,
                    basic_salary, hra, special_allowance, medical_insurance,
                    pf_employer_contribution, travelling_reimbursement, gross_ctc,
                    income_tax, medical_deduction, employer_pf, employee_pf,
                    total_deductions, net_in_hand, uploaded_by
                ) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
                ON CONFLICT (employee_code, pay_month, pay_year) DO UPDATE SET
                    pay_date = EXCLUDED.pay_date,
                    basic_salary = EXCLUDED.basic_salary,
                    hra = EXCLUDED.hra,
                    special_allowance = EXCLUDED.special_allowance,
                    medical_insurance = EXCLUDED.medical_insurance,
                    pf_employer_contribution = EXCLUDED.pf_employer_contribution,
                    travelling_reimbursement = EXCLUDED.travelling_reimbursement,
                    gross_ctc = EXCLUDED.gross_ctc,
                    income_tax = EXCLUDED.income_tax,
                    medical_deduction = EXCLUDED.medical_deduction,
                    employer_pf = EXCLUDED.employer_pf,
                    employee_pf = EXCLUDED.employee_pf,
                    total_deductions = EXCLUDED.total_deductions,
                    net_in_hand = EXCLUDED.net_in_hand,
                    uploaded_by = EXCLUDED.uploaded_by
            ''', (
                data['employee_code'], data['pay_month'], data['pay_year'], data.get('pay_date'),
                data.get('basic_salary', 0), data.get('hra', 0),
                data.get('special_allowance', 0), data.get('medical_insurance', 0),
                data.get('pf_employer_contribution', 0), data.get('travelling_reimbursement', 0),
                data.get('gross_ctc', 0), data.get('income_tax', 0),
                data.get('medical_deduction', 0), data.get('employer_pf', 0),
                data.get('employee_pf', 0), data.get('total_deductions', 0),
                data.get('net_in_hand', 0), data.get('uploaded_by')
            ))
            conn.commit()
        finally:
            conn.close()

    def get_employee_payslips(self, employee_code: str, tenant_id: str = 'public') -> List[Dict[str, Any]]:
        conn = get_db_connection()
        try:
            cur = conn.cursor(cursor_factory=RealDictCursor)
            self._set_path(cur, tenant_id)
            cur.execute('''
                SELECT * FROM payroll_records
                WHERE employee_code = %s
                ORDER BY pay_year DESC, pay_month DESC
            ''', (employee_code,))
            return [dict(r) for r in cur.fetchall()]
        finally:
            conn.close()

    def get_payroll_record(self, employee_code: str, pay_month: int, pay_year: int, tenant_id: str = 'public') -> Optional[Dict[str, Any]]:
        conn = get_db_connection()
        try:
            cur = conn.cursor(cursor_factory=RealDictCursor)
            self._set_path(cur, tenant_id)
            cur.execute(
                'SELECT * FROM payroll_records WHERE employee_code=%s AND pay_month=%s AND pay_year=%s',
                (employee_code, pay_month, pay_year)
            )
            row = cur.fetchone()
            return dict(row) if row else None
        finally:
            conn.close()

    def get_cycle_payslips(self, pay_month: int, pay_year: int, tenant_id: str = 'public') -> List[Dict[str, Any]]:
        conn = get_db_connection()
        try:
            cur = conn.cursor(cursor_factory=RealDictCursor)
            self._set_path(cur, tenant_id)
            cur.execute('''
                SELECT pr.*, e.name as employee_name, e.designation, e.team
                FROM payroll_records pr
                JOIN employees e ON pr.employee_code = e.employee_code
                WHERE pr.pay_month=%s AND pr.pay_year=%s
                ORDER BY e.name
            ''', (pay_month, pay_year))
            return [dict(r) for r in cur.fetchall()]
        finally:
            conn.close()

    def get_distinct_cycles(self, tenant_id: str = 'public') -> List[Dict[str, Any]]:
        conn = get_db_connection()
        try:
            cur = conn.cursor(cursor_factory=RealDictCursor)
            self._set_path(cur, tenant_id)
            cur.execute('''
                SELECT DISTINCT pay_month, pay_year, COUNT(*) as employee_count
                FROM payroll_records
                GROUP BY pay_month, pay_year
                ORDER BY pay_year DESC, pay_month DESC
            ''')
            return [dict(r) for r in cur.fetchall()]
        finally:
            conn.close()

    def get_employee_info(self, employee_code: str, tenant_id: str = 'public') -> Optional[Dict[str, Any]]:
        conn = get_db_connection()
        try:
            cur = conn.cursor(cursor_factory=RealDictCursor)
            self._set_path(cur, tenant_id)
            cur.execute(
                'SELECT name, designation, team, location, email_id, bank_name, bank_account_no, pan_no FROM employees WHERE employee_code=%s',
                (employee_code,)
            )
            row = cur.fetchone()
            return dict(row) if row else None
        finally:
            conn.close()
