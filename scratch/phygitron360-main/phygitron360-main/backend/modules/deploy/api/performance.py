from fastapi import APIRouter, HTTPException, Depends, Request, Body
from typing import List, Optional, Dict, Any
from backend.core.dependencies import get_current_user, require_permission
from backend.modules.deploy.services.performance_service import PerformanceService

router = APIRouter(prefix="/api/assessments", tags=["Performance"])

def get_service(user=Depends(get_current_user)):
    return PerformanceService(tenant_id=user.get('tenant_id', 'public'))

@router.get("/{employee_code}/{year}", dependencies=[Depends(require_permission("deploy.assessments.view"))])
def get_assessments(employee_code: str, year: int, service: PerformanceService = Depends(get_service)):
    return service.get_assessments(employee_code, year)

@router.post("/save")
def save_assessment(
    data: Dict[str, Any] = Body(...), 
    user=Depends(get_current_user), 
    service: PerformanceService = Depends(get_service)
):
    # This might need a more granular check, but for now we follow the service logic
    # which historically checked roles internally or passed the role.
    # We'll pass the permission-based capability soon, but for now just guard the endpoint.
    try:
        return service.save_assessment(data, user['role'], user.get('employee_code'))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/request", dependencies=[Depends(require_permission("deploy.assessments.manage"))])
def request_review(
    data: Dict[str, Any] = Body(...),
    user=Depends(get_current_user),
    service: PerformanceService = Depends(get_service)
):
    return service.request_review(data['employee_code'], data['year'], data['period_type'], data['period_value'])
