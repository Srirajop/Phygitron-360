from backend.modules.admin.repositories.org_repo import OrgRepository
from typing import Dict, Any

class OrgService:
    def __init__(self, tenant_id: str = 'public'):
        self.repo = OrgRepository(tenant_id=tenant_id)

    def get_dashboard_stats(self) -> Dict[str, Any]:
        return self.repo.get_dashboard_counts()

    def get_pipeline_funnel(self) -> list:
        raw = self.repo.get_pipeline_funnel()
        # Ensure all stages are present even with 0
        stages = ['Sourced', 'Screening', 'Training', 'Verified', 'Deployed']
        data = {s: 0 for s in stages}
        for r in raw:
            status = r['status']
            if status == 'New': status = 'Sourced'
            if status in data:
                data[status] += r['count']
        return [{"stage": s, "count": data[s]} for s in stages]

    def get_module_health(self) -> list:
        return self.repo.get_module_health()

    def get_recent_activity(self) -> list:
        return self.repo.get_recent_activity()

    def get_journey_overview(self) -> list:
        # Mocking journeys for now
        return [
            {"name": "New Hire", "steps": [{"step": 1, "count": 40}, {"step": 3, "count": 12}, {"step": 6, "count": 5}]},
            {"name": "Upskill", "steps": [{"step": 3, "count": 12}]}
        ]

    def get_team_overview(self) -> list:
        return self.repo.get_team_overview()

    def get_alerts(self) -> list:
        # Mocking alerts
        return [
            {"type": "critical", "message": "3 skill decay alerts need attention", "icon": "zap"},
            {"type": "warning", "message": "7 compliance documents expiring", "icon": "shield"},
            {"type": "warning", "message": "5 candidates stuck in screening > 14 days", "icon": "clock"}
        ]

    def get_billing_status(self) -> Dict[str, Any]:
        info = self.repo.get_billing_status()
        if not info:
             return {"plan": "Community", "seats": "N/A", "renewal": "N/A"}
        
        return {
            "plan": info.get('plan', 'Standard').capitalize() + " Platform",
            "seats": "45/100", # Mocked
            "renewal": "May 2026" # Mocked
        }
