from typing import List, Dict, Any
from backend.modules.deploy.repositories.training_repo import TrainingRepository

class TrainingService:
    def __init__(self, tenant_id: str = 'public'):
        self.repo = TrainingRepository()
        self.tenant_id = tenant_id

    def get_programs(self):
        return self.repo.get_all_programs(self.tenant_id)

    def create_program(self, data: Dict[str, Any]):
        self.repo.create_program(data['program_name'], data.get('description'), data.get('default_duration'), self.tenant_id)
        return {"success": True, "message": "Training Program created successfully"}

    def assign_training(self, employee_codes: List[str], program_id: int, date: str, duration: str):
        prog = self.repo.get_program_by_id(program_id, self.tenant_id)
        prog_name = prog['program_name'] if prog else "Unknown Program"
        
        for code in employee_codes:
            self.repo.create_assignment(code, program_id, prog_name, date, duration, self.tenant_id)
            
        return {"success": True, "message": f"Assigned training to {len(employee_codes)} employees."}

    def get_assignments(self):
        return self.repo.get_all_assignments(self.tenant_id)

    def update_status(self, assignment_id: int, status: str):
        self.repo.update_assignment_status(assignment_id, status, self.tenant_id)
        return {"success": True, "message": "Updated status successfully"}
