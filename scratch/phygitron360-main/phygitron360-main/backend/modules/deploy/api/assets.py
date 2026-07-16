from fastapi import APIRouter, HTTPException, Depends, Body
from backend.core.dependencies import get_current_user, require_permission
from backend.modules.deploy.services.asset_service import AssetService
from backend.modules.deploy.schemas.asset import AssetChecklist

router = APIRouter(prefix="/api/assets", tags=["assets"])

def get_service(user=Depends(get_current_user)):
    return AssetService(tenant_id=user.get('tenant_id', 'public'))

@router.get("/{employee_code}", dependencies=[Depends(require_permission("deploy.assets.view"))])
def get_asset_checklist(employee_code: str, service: AssetService = Depends(get_service)):
    try:
        return service.get_checklist(employee_code)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/{employee_code}", dependencies=[Depends(require_permission("deploy.assets.manage"))])
def upsert_asset_checklist(employee_code: str, data: dict = Body(...), service: AssetService = Depends(get_service)):
    # Using generic dict for body to allow flexibility, but we could use AssetChecklist schema
    try:
        return service.upsert_checklist(employee_code, data)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
