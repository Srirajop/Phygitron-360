from fastapi import APIRouter, Depends, HTTPException
from typing import List, Optional
from pydantic import BaseModel
from backend.core.dependencies import require_permission, get_current_user
from backend.modules.admin.services.admin_service import AdminService
from backend.modules.admin.schemas.admin import UserCreate, UserResponse, LogResponse, RolePermissionsUpdate, UserOverrideUpdate, RoleUpdate

class ProvisionTenantRequest(BaseModel):
    company_name: str
    admin_email: str
    admin_password: str

router = APIRouter(prefix="/api/admin", tags=["admin"], dependencies=[Depends(require_permission("admin.users.manage"))])

def get_service(current_user: dict = Depends(get_current_user)):
    return AdminService(tenant_id=current_user.get('tenant_id', 'public'))

@router.get("/users", response_model=List[UserResponse])
def list_users(service: AdminService = Depends(get_service)):
    return service.list_users()

@router.get("/tenants")
def list_tenants(service: AdminService = Depends(get_service)):
    return service.list_tenants()

@router.post("/tenants", dependencies=[Depends(require_permission("admin.tenants.provision"))])
def provision_tenant(data: ProvisionTenantRequest, current_user: dict = Depends(get_current_user), service: AdminService = Depends(get_service)):
    try:
        return service.provision_tenant(data.company_name, data.admin_email, data.admin_password, current_user['username'])
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/tenants/{tenant_id}", dependencies=[Depends(require_permission("admin.tenants.provision"))])
def delete_tenant(tenant_id: str, current_user: dict = Depends(get_current_user), service: AdminService = Depends(get_service)):
    try:
        return service.delete_tenant(tenant_id, current_user['username'])
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/users")
def add_new_user(user: UserCreate, current_user: dict = Depends(get_current_user), service: AdminService = Depends(get_service)):
    try:
        return service.create_user(user.username, user.password, user.role, current_user['username'], current_user['role'], user.employee_code)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/users/{user_id}")
def delete_existing_user(user_id: int, current_user: dict = Depends(get_current_user), service: AdminService = Depends(get_service)):
    try:
        return service.delete_user(user_id, current_user['username'])
    except ValueError as e:
        if "not found" in str(e).lower():
             raise HTTPException(status_code=404, detail=str(e))
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/logs", response_model=List[LogResponse])
def view_logs(service: AdminService = Depends(get_service)):
    return service.get_logs()

@router.get("/permissions/roles")
def get_role_permissions(service: AdminService = Depends(get_service)):
    return service.get_role_permissions()

@router.post("/permissions/roles")
def update_role_permissions(update: RolePermissionsUpdate, current_user: dict = Depends(get_current_user), service: AdminService = Depends(get_service)):
    try:
        return service.update_role_permissions(update.role, update.permissions, current_user['username'])
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/permissions/users/{user_id}")
def get_user_overrides(user_id: int, service: AdminService = Depends(get_service)):
    return service.get_user_overrides(user_id)

@router.post("/permissions/users/{user_id}")
def update_user_overrides(user_id: int, update: UserOverrideUpdate, current_user: dict = Depends(get_current_user), service: AdminService = Depends(get_service)):
    try:
        return service.update_user_overrides(user_id, update.overrides, current_user['username'])
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

class EmployeeCodeUpdate(BaseModel):
    employee_code: Optional[str] = None

@router.patch("/users/{user_id}/employee-code")
def update_user_employee_code(
    user_id: int,
    data: EmployeeCodeUpdate,
    current_user: dict = Depends(get_current_user),
    service: AdminService = Depends(get_service)
):
    try:
        return service.update_employee_code(user_id, data.employee_code, current_user['username'])
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.patch("/users/{user_id}/role")
def update_user_role(
    user_id: int,
    data: RoleUpdate,
    current_user: dict = Depends(get_current_user),
    service: AdminService = Depends(get_service)
):
    try:
        return service.update_role(user_id, data.role, current_user['username'], current_user['role'])
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

class ToggleActiveUpdate(BaseModel):
    is_active: bool

@router.patch("/users/{user_id}/toggle")
def toggle_user_active(
    user_id: int,
    data: ToggleActiveUpdate,
    current_user: dict = Depends(get_current_user),
    service: AdminService = Depends(get_service)
):
    try:
        return service.toggle_user_active(user_id, data.is_active, current_user['username'], current_user['role'])
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

class TenantOpsUpdate(BaseModel):
    company_name: Optional[str] = None
    modules_enabled: Optional[List[str]] = None
    plan: Optional[str] = None
    is_active: Optional[bool] = None

@router.get("/tenants/{tenant_id}/ops")
def get_tenant_ops(tenant_id: str, service: AdminService = Depends(get_service)):
    if tenant_id == 'current':
        return service.get_tenant_ops(service.tenant_id)
    return service.get_tenant_ops(tenant_id)

@router.patch("/tenants/{tenant_id}/ops")
def update_tenant_ops(tenant_id: str, data: TenantOpsUpdate, current_user: dict = Depends(get_current_user), service: AdminService = Depends(get_service)):
    target_id = service.tenant_id if tenant_id == 'current' else tenant_id
    return service.update_tenant_ops(target_id, data.dict(exclude_none=True), current_user['username'])
