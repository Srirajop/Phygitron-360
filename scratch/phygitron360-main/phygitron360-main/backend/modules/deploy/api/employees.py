from fastapi import APIRouter, HTTPException, Depends, Form, File, UploadFile, Body
from typing import List
from backend.core.dependencies import require_permission, get_current_user
from backend.modules.deploy.services.employee_service import EmployeeService
from backend.modules.deploy.schemas.employee import UpdateEmployeeRequest, OffboardRequest
from backend.core.database import DATA_DIR
from backend.common.services.storage_service import save_uploaded_file
import os
import shutil

router = APIRouter(prefix="/api", tags=["employees"])

def get_service(tenant_id: str = 'public'):
    return EmployeeService(tenant_id=tenant_id)

@router.get("/employees", dependencies=[Depends(require_permission("deploy.employees.view"))])
def get_employees(current_user: dict = Depends(get_current_user)):
    tenant_id = current_user.get('tenant_id', 'public')
    service = get_service(tenant_id)
    return service.get_all_employees()

@router.get("/employee/{employee_code}", dependencies=[Depends(require_permission("deploy.employees.view"))])
def get_employee(employee_code: str, current_user: dict = Depends(get_current_user)):
    tenant_id = current_user.get('tenant_id', 'public')
    service = get_service(tenant_id)
    employee = service.get_employee_full_details(employee_code)
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")
    return employee

@router.post("/employee", dependencies=[Depends(require_permission("deploy.employees.create"))])
async def create_employee(
    code: str = Form(...),
    name: str = Form(...),
    dob: str = Form(...),
    phone: str = Form(...),
    emergency: str = Form(...),
    email: str = Form(...),
    doj: str = Form(...),
    team: str = Form(...),
    designation: str = Form(...),
    role: str = Form(...),
    type: str = Form(...),
    manager: str = Form(...),
    location: str = Form(...),
    current_address: str = Form(None),
    permanent_address: str = Form(None),
    pf: str = Form(None),
    mediclaim: str = Form(None),
    notes: str = Form(None),
    primary_skillset: str = Form(None),
    secondary_skillset: str = Form(None),
    experience_years: float = Form(None),
    photo_file: UploadFile = File(None),
    cv_file: UploadFile = File(None),
    id_proof_file: UploadFile = File(None),
    education_details: str = Form(None),
    current_user: dict = Depends(get_current_user)
):
    tenant_id = current_user.get('tenant_id', 'public')
    service = get_service(tenant_id)
    
    photo_path = save_uploaded_file(photo_file, tenant_id, 'deploy', 'pfp', code, 'pfp')
    cv_path = save_uploaded_file(cv_file, tenant_id, 'deploy', 'resume', code, 'cv')
    id_proofs_path = save_uploaded_file(id_proof_file, tenant_id, 'deploy', 'identification_docs', code, 'id_proof')

    data = {
        "code": code, "name": name, "dob": dob, "phone": phone, "emergency": emergency,
        "email": email, "doj": doj, "team": team, "designation": designation, "role": role, "type": type,
        "manager": manager, "location": location, "current_address": current_address,
        "permanent_address": permanent_address, "pf": pf, "mediclaim": mediclaim, "notes": notes,
        "education_details": education_details,
        "primary_skillset": primary_skillset, "secondary_skillset": secondary_skillset,
        "experience_years": experience_years, "photo_path": photo_path, "cv_path": cv_path,
        "id_proofs": id_proofs_path
    }

    try:
        return service.create_employee(data)
    except ValueError as e:
         raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
         raise HTTPException(status_code=500, detail=str(e))

@router.put("/employee/{employee_code}", dependencies=[Depends(require_permission("deploy.employees.edit"))])
def update_employee(employee_code: str, data: dict = Body(...), current_user: dict = Depends(get_current_user)):
    tenant_id = current_user.get('tenant_id', 'public')
    service = get_service(tenant_id)
    try:
        return service.update_employee(employee_code, data)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/employee/{employee_code}/documents", dependencies=[Depends(require_permission("deploy.employees.edit"))])
async def upload_documents(
    employee_code: str,
    photo_file: UploadFile = File(None),
    cv_file: UploadFile = File(None),
    id_proof_file: UploadFile = File(None),
    current_user: dict = Depends(get_current_user)
):
    tenant_id = current_user.get('tenant_id', 'public')
    service = get_service(tenant_id)
    updates = {}
    
    if photo_file:
        updates['photo_path'] = save_uploaded_file(photo_file, tenant_id, 'deploy', 'pfp', employee_code, 'pfp')
    if cv_file:
        updates['cv_path'] = save_uploaded_file(cv_file, tenant_id, 'deploy', 'resume', employee_code, 'cv')
    if id_proof_file:
        updates['id_proofs'] = save_uploaded_file(id_proof_file, tenant_id, 'deploy', 'identification_docs', employee_code, 'id_proof')
        
    if not updates:
        return {"message": "No files received"}

    try:
        return service.update_employee(employee_code, updates)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/employee/{employee_code}", dependencies=[Depends(require_permission("deploy.employees.delete"))])
def delete_employee(employee_code: str, current_user: dict = Depends(get_current_user)):
    tenant_id = current_user.get('tenant_id', 'public')
    service = get_service(tenant_id)
    try:
        return service.delete_employee(employee_code)
    except ValueError as e:
         raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
         raise HTTPException(status_code=500, detail=str(e))

@router.get("/options", dependencies=[Depends(require_permission("deploy.employees.view"))])
def get_dropdown_options(current_user: dict = Depends(get_current_user)):
    tenant_id = current_user.get('tenant_id', 'public')
    service = get_service(tenant_id)
    return service.get_options()

@router.post("/employee/{employee_code}/offboard", dependencies=[Depends(require_permission("deploy.employees.offboard"))])
def offboard_employee(employee_code: str, data: OffboardRequest, current_user: dict = Depends(get_current_user)):
    tenant_id = current_user.get('tenant_id', 'public')
    service = get_service(tenant_id)
    try:
        return service.offboard_employee(employee_code, data)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

import io
import json
import pandas as pd
from fastapi.responses import StreamingResponse

@router.get("/employees/bulk-upload/template", dependencies=[Depends(require_permission("deploy.employees.create"))])
def get_bulk_upload_template():
    columns = [
        "Employee Code", "Name", "Email ID", "Role", "Date of Joining", 
        "Designation", "Team / Department", "Employment Type", "Reporting Manager", 
        "Base Location", "Employment Status", "Date of Birth", "Contact Number", 
        "Emergency Contact Name", "Emergency Contact", "Current Address", "Permanent Address", 
        "Primary Skills", "Secondary Skills", "Experience Years", "Education Details",
        "Bank Name", "Bank Account No.", "PAN No.", "PF Included", "Mediclaim Included", "Notes"
    ]
    df = pd.DataFrame(columns=columns)
    output = io.BytesIO()
    with pd.ExcelWriter(output, engine='xlsxwriter') as writer:
        df.to_excel(writer, index=False, sheet_name='Template')
        
        workbook = writer.book
        worksheet = writer.sheets['Template']
        header_format = workbook.add_format({
            'bold': True,
            'bg_color': '#D7E4BC',
            'border': 1
        })
        for col_num, value in enumerate(df.columns.values):
            worksheet.write(0, col_num, value, header_format)
            worksheet.set_column(col_num, col_num, 20)
            
    output.seek(0)
    
    headers = {
        'Content-Disposition': 'attachment; filename="employee_bulk_upload_template.xlsx"'
    }
    
    return StreamingResponse(output, headers=headers, media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")

@router.post("/employees/bulk", dependencies=[Depends(require_permission("deploy.employees.create"))])
def bulk_upload_employees(employees: List[dict] = Body(...), current_user: dict = Depends(get_current_user)):
    tenant_id = current_user.get('tenant_id', 'public')
    service = get_service(tenant_id)
    
    results = {
        "total": len(employees),
        "success": 0,
        "failed": 0,
        "errors": []
    }
    
    for row in employees:
        try:
            data = {
                "code": str(row.get("Employee Code", "")).strip(),
                "name": str(row.get("Name", "")).strip(),
                "dob": str(row.get("Date of Birth", "")).strip(),
                "phone": str(row.get("Contact Number", "")).strip(),
                "emergency": f"{str(row.get('Emergency Contact Name', '')).strip()} - {str(row.get('Emergency Contact', '')).strip()}" if str(row.get('Emergency Contact Name', '')).strip() else str(row.get('Emergency Contact', '')).strip(),
                "email": str(row.get("Email ID", "")).strip(),
                "doj": str(row.get("Date of Joining", "")).strip(),
                "team": str(row.get("Team / Department", "")).strip(),
                "designation": str(row.get("Designation", "")).strip(),
                "role": str(row.get("Role", "employee")).strip().lower() or "employee",
                "type": str(row.get("Employment Type", "Full-time")).strip() or "Full-time",
                "manager": str(row.get("Reporting Manager", "")).strip(),
                "location": str(row.get("Base Location", "")).strip(),
                "employment_status": str(row.get("Employment Status", "Active")).strip() or "Active",
                "current_address": str(row.get("Current Address", "")).strip(),
                "permanent_address": str(row.get("Permanent Address", "")).strip(),
                "pf": "Yes" if str(row.get("PF Included", "")).strip().lower() in ['yes', 'true', '1'] else "No",
                "mediclaim": "Yes" if str(row.get("Mediclaim Included", "")).strip().lower() in ['yes', 'true', '1'] else "No",
                "notes": str(row.get("Notes", "")).strip(),
                "primary_skillset": str(row.get("Primary Skills", "")).strip(),
                "secondary_skillset": str(row.get("Secondary Skills", "")).strip(),
                "experience_years": float(row.get("Experience Years", 0) or 0),
                "bank_name": str(row.get("Bank Name", "")).strip(),
                "bank_account_no": str(row.get("Bank Account No.", "")).strip(),
                "pan_no": str(row.get("PAN No.", "")).strip(),
                "photo_path": "",
                "cv_path": "",
                "id_proofs": "",
                "education_details": json.loads(str(row.get("Education Details", "[]")).strip() or "[]") if str(row.get("Education Details", "")).strip() else []
            }
            
            # Fallback if parsing fails (handled broadly by except Exception below, but let's be safe)
            if not isinstance(data["education_details"], list):
                data["education_details"] = []

            
            if not data["code"] or not data["name"] or not data["email"]:
                raise ValueError("Missing mandatory fields (Code, Name, Email)")
                
            service.create_employee(data)
            results["success"] += 1
        except Exception as e:
            results["failed"] += 1
            results["errors"].append({
                "code": str(row.get("Employee Code", "Unknown")),
                "error": str(e)
            })
            
    return results
