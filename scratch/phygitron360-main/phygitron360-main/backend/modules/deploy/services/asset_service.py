from typing import Dict, Any, List
from backend.modules.deploy.repositories.asset_repo import AssetRepository

class AssetService:
    def __init__(self, tenant_id: str = 'public'):
        self.repo = AssetRepository()
        self.tenant_id = tenant_id

    def get_checklist(self, employee_code: str) -> Dict[str, Any]:
        result = self.repo.get_asset_checklist(employee_code, tenant_id=self.tenant_id)
        
        if result:
            return result
        else:
            # Default
            ob_pf = 0
            ob_mediclaim = 0
            
            emp_defaults = self.repo.get_employee_defaults(employee_code, tenant_id=self.tenant_id)
            if emp_defaults:
                pf = emp_defaults.get('pf_included')
                med = emp_defaults.get('mediclaim_included')
                if pf and str(pf).lower() in ['yes', 'true', '1', 'on']: ob_pf = 1
                if med and str(med).lower() in ['yes', 'true', '1', 'on']: ob_mediclaim = 1
            
            return {
                "employee_code": employee_code,
                "ob_pf": ob_pf,
                "ob_mediclaim": ob_mediclaim
            }

    def upsert_checklist(self, employee_code: str, data: Dict[str, Any]):
        if self.repo.check_exists(employee_code, tenant_id=self.tenant_id):
            self.repo.update_asset_checklist(employee_code, data, tenant_id=self.tenant_id)
        else:
            self.repo.create_asset_checklist(employee_code, data, tenant_id=self.tenant_id)

        # Sync back to employees table to ensure Compliance Protocol stays updated
        sync_fields = []
        sync_values = []
        if 'ob_pf' in data:
            sync_fields.append('pf_included')
            sync_values.append('Yes' if data['ob_pf'] else 'No')
        if 'ob_mediclaim' in data:
            sync_fields.append('mediclaim_included')
            sync_values.append('Yes' if data['ob_mediclaim'] else 'No')
            
        if sync_fields:
            try:
                from backend.modules.deploy.repositories.employee_repo import EmployeeRepository
                EmployeeRepository().update_employee_fields(employee_code, sync_fields, sync_values, self.tenant_id)
            except Exception as e:
                print("Failed to sync employee compliance fields from assets:", e)
        
        return {"success": True, "message": "Allocation protocol updated successfully"}
