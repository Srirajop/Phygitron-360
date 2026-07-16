from typing import List, Dict, Any, Optional
from backend.modules.deploy.repositories.performance_repo import PerformanceRepository
from backend.modules.deploy.services.notification_service import add_notification

class AssessmentService:
    def __init__(self, tenant_id: str = 'public'):
        self.repo = PerformanceRepository()
        self.tenant_id = tenant_id

    def get_assessments(self, employee_code: str, year: int, user: dict):
        # type parameter is passed via query string in frontend
        # but for simplicity we'll just return all for that employee/year
        return self.repo.get_assessments(employee_code, year, self.tenant_id)

    def save_assessment(self, req: Any, user: dict):
        # req can be a dict (from Body) or a schema
        data = req if isinstance(req, dict) else req.dict()
        user_role = user['role']
        
        # Check existing to enforce edit rules
        assessments = self.repo.get_assessments(data['employee_code'], data['year'], self.tenant_id)
        existing = next((a for a in assessments if a['period_type'] == data['period_type'] and a['period_value'] == data['period_value']), None)
        
        # Rule: If the user is editing their OWN assessment, they are act as an employee (L4)
        is_self = (user.get('employee_code') == data['employee_code'] and user.get('employee_code') is not None)
        
        reporting_manager = self.repo.get_employee_reporting_manager(data['employee_code'], self.tenant_id)
        is_reporting_manager = (user.get('employee_code') == reporting_manager and reporting_manager is not None)
        
        if existing:
            # Rule 1: L4 (employee) cannot edit after submission
            if not is_self or user_role not in ['Admin', 'HR', 'Management', 'org_admin', 'manager', 'super_admin']:
                if not (user_role in ['Admin', 'HR', 'Management', 'org_admin', 'manager', 'super_admin'] and not is_self):
                    if existing['status'] in ['Submitted', 'Reviewed', 'Finalized']:
                        raise ValueError("Assessment already submitted. Contact manager for changes.")
            
            # Rule 2: Separation of Concerns
            new_entries = []
            for i, old_entry in enumerate(existing['entries']):
                # Find matching entry by category/subcategory
                target_cat = old_entry.get('category')
                target_sub = old_entry.get('subcategory')
                new_entry = next((e for e in data['entries'] if e.get('category') == target_cat and e.get('subcategory') == target_sub), data['entries'][i] if i < len(data['entries']) else {})
                
                # 1. Update Employee perspective if editing own record
                if is_self:
                    old_entry['self_score'] = new_entry.get('self_score')
                    old_entry['employee_comment'] = new_entry.get('employee_comment')
                
                # 2. Update Manager perspective if user is reporting manager or global admin
                if is_reporting_manager or user_role in ['Admin', 'HR', 'Management', 'org_admin', 'super_admin']:
                    # Note: If it's a manager's own assessment, they can still update 
                    # their manager review part from the management panel.
                    old_entry['manager_score'] = new_entry.get('manager_score')
                    old_entry['manager_comment'] = new_entry.get('manager_comment')
                
                # Combined score prioritization
                old_entry['score'] = old_entry.get('manager_score') or old_entry.get('self_score') or 0
                new_entries.append(old_entry)
            data['entries'] = new_entries
        else:
            # New assessment
            for entry in data['entries']:
                entry['score'] = entry.get('manager_score') or entry.get('self_score') or 0

        # Calculate totals
        self_total = sum(e.get('self_score', 0) if e.get('self_score') is not None else 0 for e in data['entries'])
        self_applicable = len([e for e in data['entries'] if e.get('self_score') is not None and e.get('self_score') > 0])
        data['self_percentage'] = round((self_total / (self_applicable * 10)) * 100) if self_applicable > 0 else 0

        manager_total = sum(e.get('score', 0) for e in data['entries'])
        manager_applicable = len([e for e in data['entries'] if e.get('manager_score') is not None and e.get('manager_score') > 0])
        data['total_score'] = manager_total
        data['percentage'] = round((manager_total / (manager_applicable * 10)) * 100) if manager_applicable > 0 else 0

        result = self.repo.save_assessment(data, self.tenant_id)
        
        # Notifications
        if data['status'] == 'Submitted' and user_role not in ['Admin', 'manager', 'org_admin', 'super_admin']:
            add_notification(
                title="Performance Sync Required",
                message=f"Deployment unit {data['employee_code']} has submitted their {data['period_value']} self-assessment.",
                n_type="AdminAlert",
                tenant_id=self.tenant_id
            )
        elif data['status'] == 'Reviewed':
            add_notification(
                title="Performance Matrix Finalized",
                message=f"Your {data['period_value']} performance protocol has been reviewed and synced.",
                employee_code=data['employee_code'],
                n_type="Success",
                tenant_id=self.tenant_id
            )
            
        return result

    def request_review(self, employee_code: str, year: int, p_type: str, p_value: str):
        add_notification(
            title="Performance Review Protocol",
            message=f"Command has requested your performance self-assessment for {p_value} {year}.",
            employee_code=employee_code,
            n_type="Alert",
            tenant_id=self.tenant_id
        )
        # Detailed KRA template setup
        template_subcategories = [
            ("Performance", "Adherence to schedules"),
            ("Performance", "Quality of deliverables"),
            ("Performance", "Stakeholder feedback"),
            ("Performance", "Team contribution"),
            ("Potential", "Communication and influence"),
            ("Potential", "Problem-solving"),
            ("Potential", "Adaptability"),
            ("Values", "Integrity and accountability"),
            ("Values", "Teamwork and collaboration"),
            ("Values", "Initiative and proactivity"),
            ("Growth and Development", "Learning and upskilling"),
            ("Growth and Development", "Team development contribution"),
            ("Impact", "Creativity and originality"),
            ("Impact", "Business goal contributions"),
        ]
        
        entries = [
            {
                "category": cat, "subcategory": sub,
                "self_score": None, "manager_score": None, "score": 0,
                "employee_comment": "", "manager_comment": ""
            } for cat, sub in template_subcategories
        ]

        data = {
            "employee_code": employee_code,
            "year": year,
            "period_type": p_type,
            "period_value": p_value,
            "status": "Requested",
            "entries": entries,
            "total_score": 0,
            "percentage": 0,
            "self_percentage": 0
        }
        self.repo.save_assessment(data, self.tenant_id)
        return {"success": True, "message": "Review protocol initiated"}
