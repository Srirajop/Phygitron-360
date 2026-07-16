from typing import List, Dict, Any, Optional
from backend.modules.deploy.repositories.performance_repo import PerformanceRepository
from backend.modules.deploy.services.notification_service import add_notification

class PerformanceService:
    def __init__(self, tenant_id: str = 'public'):
        self.repo = PerformanceRepository()
        self.tenant_id = tenant_id

    def save_assessment(self, data: Dict[str, Any], user_role: str, user_code: str):
        # Validation and score calculation
        entries = data.get('entries', [])
        total = 0
        for entry in entries:
            # Score is manager_score if finalized/submitted, else self_score
            entry['score'] = entry.get('manager_score') or entry.get('self_score') or 0
            total += entry['score']
        
        data['total_score'] = total
        data['percentage'] = round((total / (len(entries) * 10)) * 100) if entries else 0
        
        # Check if existing assessment to enforce edit rules
        existing = None
        assessments = self.repo.get_assessments(data['employee_code'], data['year'], self.tenant_id)
        for a in assessments:
            if a['period_type'] == data['period_type'] and a['period_value'] == data['period_value']:
                existing = a
                break
        
        if existing:
            # Rule: L4 cannot edit after submission
            if user_role not in ['Admin', 'HR', 'Management', 'org_admin', 'manager']:
                if existing['status'] in ['Submitted', 'Reviewed', 'Finalized']:
                    raise ValueError("Assessment already submitted. Contact manager for changes.")
            
            # Rule: Manager/Admin cannot edit employee self-scores/comments
            # We enforce this by merging ONLY the fields allowed for the role
            new_entries = []
            for i, old_entry in enumerate(existing['entries']):
                new_entry = data['entries'][i]
                if user_role in ['Admin', 'HR', 'Management', 'org_admin', 'manager']:
                    # Manager keeps old employee data, updates their own
                    old_entry['manager_score'] = new_entry.get('manager_score')
                    old_entry['manager_comment'] = new_entry.get('manager_comment')
                    old_entry['score'] = old_entry.get('manager_score') or old_entry.get('self_score') or 0
                    new_entries.append(old_entry)
                else:
                    # Employee keeps old manager data, updates their own
                    old_entry['self_score'] = new_entry.get('self_score')
                    old_entry['employee_comment'] = new_entry.get('employee_comment')
                    old_entry['score'] = old_entry.get('manager_score') or old_entry.get('self_score') or 0
                    new_entries.append(old_entry)
            data['entries'] = new_entries
            
            # Recalculate totals after merge
            total = sum(e['score'] for e in new_entries)
            data['total_score'] = total
            data['percentage'] = round((total / (len(new_entries) * 10)) * 100) if new_entries else 0

        result = self.repo.save_assessment(data, self.tenant_id)
        
        # Notifications
        if data['status'] == 'Submitted':
            add_notification(
                title="Performance Self-Assessment Submitted",
                message=f"Employee {data['employee_code']} has submitted their {data['period_value']} review.",
                n_type="AdminAlert",
                tenant_id=self.tenant_id
            )
        elif data['status'] == 'Reviewed':
            add_notification(
                title="Performance Review Finalized",
                message=f"Your {data['period_value']} performance review has been finalized by management.",
                employee_code=data['employee_code'],
                n_type="Success",
                tenant_id=self.tenant_id
            )
            
        return result

    def get_assessments(self, employee_code: str, year: int):
        return self.repo.get_assessments(employee_code, year, self.tenant_id)

    def request_review(self, employee_code: str, year: int, p_type: str, p_value: str):
        # Create a blank draft if not exists
        data = {
            "employee_code": employee_code,
            "year": year,
            "period_type": p_type,
            "period_value": p_value,
            "status": "Draft",
            "entries": [], # Frontend will populate with default template
            "total_score": 0,
            "percentage": 0
        }
        
        add_notification(
            title="Performance Review Requested",
            message=f"Management has requested your performance self-assessment for {p_value} {year}.",
            employee_code=employee_code,
            n_type="Alert",
            tenant_id=self.tenant_id
        )
        return {"success": True, "message": "Review request sent"}
