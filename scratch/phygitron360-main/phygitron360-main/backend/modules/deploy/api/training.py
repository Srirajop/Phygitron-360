from fastapi import APIRouter, HTTPException, Body, Depends
from backend.modules.deploy.services.training_service import TrainingService
from backend.core.dependencies import require_permission, get_current_user 
from backend.modules.deploy.schemas.training import CreateProgramRequest, AssignTrainingRequest, UpdateAssignmentStatusRequest

router = APIRouter(prefix="/api/training", tags=["training"])

def get_service(user=Depends(get_current_user)):
    return TrainingService(tenant_id=user.get('tenant_id', 'public'))

@router.get("/programs", dependencies=[Depends(require_permission("deploy.training.view"))])
def get_training_programs(service: TrainingService = Depends(get_service)):
    return service.get_programs()

@router.post("/programs", dependencies=[Depends(require_permission("deploy.training.manage"))])
def create_training_program(req: CreateProgramRequest, service: TrainingService = Depends(get_service)):
    try:
        return service.create_program(req.dict())
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/assignments", dependencies=[Depends(require_permission("deploy.training.view"))])
def get_all_assignments(service: TrainingService = Depends(get_service)):
    return service.get_assignments()

@router.post("/assign", dependencies=[Depends(require_permission("deploy.training.manage"))])
def assign_training(req: AssignTrainingRequest, service: TrainingService = Depends(get_service)):
    try:
        # Pydantic maps `employee_codes` correctly
        return service.assign_training(req.employee_codes, req.program_id, req.date, req.duration)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/assignment/{id}", dependencies=[Depends(require_permission("deploy.training.manage"))])
def update_assignment_status(id: int, req: UpdateAssignmentStatusRequest, service: TrainingService = Depends(get_service)):
    try:
        return service.update_status(id, req.status)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
