from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, Body
from fastapi.responses import Response
from typing import Optional
from backend.core.dependencies import require_permission, get_current_user
from backend.modules.deploy.services.payroll_service import PayrollService, MONTH_NAMES
from backend.modules.deploy.schemas.payroll import PayrollPushRequest

router = APIRouter(prefix="/api", tags=["payroll"])


def get_service(tenant_id: str = 'public') -> PayrollService:
    return PayrollService(tenant_id=tenant_id)


@router.get("/payroll/admin/template", dependencies=[Depends(require_permission("deploy.payroll.manage"))])
def download_payroll_template():
    """Admin: download the payroll excel template."""
    import os
    from fastapi.responses import FileResponse
    base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(__file__))))
    template_path = os.path.join(base_dir, 'assets', 'PAYROLL TEMPLATE.xlsx')
    if not os.path.exists(template_path):
        raise HTTPException(status_code=404, detail="Template file not found")
    return FileResponse(template_path, filename="PAYROLL_TEMPLATE.xlsx", media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")



@router.post("/payroll/upload", dependencies=[Depends(require_permission("deploy.payroll.manage"))])
async def upload_payroll_excel(
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user)
):
    """Parse Excel and return preview data. Does NOT write to DB."""
    if not file.filename.endswith(('.xlsx', '.xls')):
        raise HTTPException(status_code=400, detail="Only .xlsx files are accepted")
    tenant_id = current_user.get('tenant_id', 'public')
    service = get_service(tenant_id)
    try:
        file_bytes = await file.read()
        records = service.parse_excel(file_bytes)
        return {"success": True, "preview": records, "count": len(records)}
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to parse Excel: {str(e)}")


@router.post("/payroll/push", dependencies=[Depends(require_permission("deploy.payroll.manage"))])
async def push_pay_cycle(
    data: PayrollPushRequest,
    current_user: dict = Depends(get_current_user)
):
    """Confirm and write payroll records to DB + notify employees."""
    tenant_id = current_user.get('tenant_id', 'public')
    service = get_service(tenant_id)
    records = [r.dict() for r in data.records]
    result = service.push_pay_cycle(
        records, data.pay_month, data.pay_year,
        data.pay_date, current_user.get('username', 'admin')
    )
    return {"success": True, **result}


@router.get("/payroll/cycles", dependencies=[Depends(require_permission("deploy.payroll.manage"))])
def get_pay_cycles(current_user: dict = Depends(get_current_user)):
    """Get all distinct pay cycles."""
    tenant_id = current_user.get('tenant_id', 'public')
    service = get_service(tenant_id)
    return service.get_distinct_cycles()


@router.get("/payroll/cycle/{year}/{month}", dependencies=[Depends(require_permission("deploy.payroll.manage"))])
def get_cycle_detail(year: int, month: int, current_user: dict = Depends(get_current_user)):
    """Get all employee payslips for a specific pay cycle."""
    tenant_id = current_user.get('tenant_id', 'public')
    service = get_service(tenant_id)
    return service.get_cycle_summary(month, year)


@router.get("/payroll/employee/{employee_code}", dependencies=[Depends(require_permission("deploy.payroll.manage"))])
def get_employee_payslips_admin(employee_code: str, current_user: dict = Depends(get_current_user)):
    """Admin: get all payslips for a specific employee."""
    tenant_id = current_user.get('tenant_id', 'public')
    service = get_service(tenant_id)
    return service.get_employee_payslips(employee_code)


@router.get("/payroll/my", dependencies=[Depends(require_permission("deploy.payroll.view"))])
def get_my_payslips(current_user: dict = Depends(get_current_user)):
    """Employee: get own payslip list."""
    employee_code = current_user.get('employee_code')
    if not employee_code:
        raise HTTPException(status_code=400, detail="No employee profile linked")
    tenant_id = current_user.get('tenant_id', 'public')
    service = get_service(tenant_id)
    return service.get_employee_payslips(employee_code)


@router.get("/payroll/my/{year}/{month}", dependencies=[Depends(require_permission("deploy.payroll.view"))])
def get_my_payslip_detail(year: int, month: int, current_user: dict = Depends(get_current_user)):
    """Employee: get a single payslip breakdown."""
    employee_code = current_user.get('employee_code')
    if not employee_code:
        raise HTTPException(status_code=400, detail="No employee profile linked")
    tenant_id = current_user.get('tenant_id', 'public')
    service = get_service(tenant_id)
    record = service.get_payroll_record(employee_code, month, year)
    if not record:
        raise HTTPException(status_code=404, detail="Payslip not found")
    return record


@router.get("/payroll/download/{year}/{month}", dependencies=[Depends(require_permission("deploy.payroll.view"))])
def download_payslip_pdf(year: int, month: int, current_user: dict = Depends(get_current_user)):
    """Employee: download own payslip as PDF."""
    employee_code = current_user.get('employee_code')
    if not employee_code:
        raise HTTPException(status_code=400, detail="No employee profile linked")
    tenant_id = current_user.get('tenant_id', 'public')
    service = get_service(tenant_id)
    pdf_bytes = service.generate_payslip_pdf(employee_code, month, year)
    if not pdf_bytes:
        raise HTTPException(status_code=404, detail="Payslip not found")
    month_name = MONTH_NAMES.get(month, str(month))
    return Response(
        content=pdf_bytes,
        media_type='application/pdf',
        headers={'Content-Disposition': f'attachment; filename=payslip_{employee_code}_{month_name}_{year}.pdf'}
    )


@router.get("/payroll/admin/download/{employee_code}/{year}/{month}", dependencies=[Depends(require_permission("deploy.payroll.manage"))])
def admin_download_payslip_pdf(
    employee_code: str, year: int, month: int,
    current_user: dict = Depends(get_current_user)
):
    """Admin: download any employee's payslip as PDF."""
    tenant_id = current_user.get('tenant_id', 'public')
    service = get_service(tenant_id)
    pdf_bytes = service.generate_payslip_pdf(employee_code, month, year)
    if not pdf_bytes:
        raise HTTPException(status_code=404, detail="Payslip not found")
    month_name = MONTH_NAMES.get(month, str(month))
    return Response(
        content=pdf_bytes,
        media_type='application/pdf',
        headers={'Content-Disposition': f'attachment; filename=payslip_{employee_code}_{month_name}_{year}.pdf'}
    )


@router.post("/payroll/preview-pdf", dependencies=[Depends(require_permission("deploy.payroll.manage"))])
async def preview_pdf(
    record: dict = Body(...),
    current_user: dict = Depends(get_current_user)
):
    """Generate a PDF preview from a raw parsed JSON record (no DB save)."""
    tenant_id = current_user.get('tenant_id', 'public')
    service = get_service(tenant_id)
    pdf_bytes = service.generate_preview_payslip_pdf(record)
    if not pdf_bytes:
        raise HTTPException(status_code=400, detail="Failed to generate preview PDF")
    
    return Response(
        content=pdf_bytes,
        media_type='application/pdf'
    )
