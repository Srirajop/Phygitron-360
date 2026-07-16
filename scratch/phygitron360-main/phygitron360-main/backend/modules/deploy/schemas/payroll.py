from pydantic import BaseModel
from typing import Optional, List


class PayrollRecord(BaseModel):
    employee_code: str
    pay_month: int
    pay_year: int
    pay_date: Optional[str] = None
    basic_salary: float = 0
    hra: float = 0
    special_allowance: float = 0
    medical_insurance: float = 0
    pf_employer_contribution: float = 0
    travelling_reimbursement: float = 0
    gross_ctc: float = 0
    income_tax: float = 0
    medical_deduction: float = 0
    employer_pf: float = 0
    employee_pf: float = 0
    total_deductions: float = 0
    net_in_hand: float = 0


class PayrollPushRequest(BaseModel):
    pay_month: int
    pay_year: int
    pay_date: Optional[str] = None
    records: List[PayrollRecord]
