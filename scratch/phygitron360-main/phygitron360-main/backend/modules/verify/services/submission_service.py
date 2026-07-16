import asyncio
import json
import logging
from typing import List, Dict, Any, Optional

from backend.modules.verify.repositories.submission_repo import SubmissionRepository
from backend.modules.verify.repositories.assessment_repo import AssessmentRepository
from backend.common.services.ai.agents import AIAgents

logger = logging.getLogger(__name__)

class SubmissionService:
    def __init__(self, tenant_id: str = 'public'):
        self.tenant_id = tenant_id
        self.repo = SubmissionRepository(tenant_id=tenant_id)
        self.assessment_repo = AssessmentRepository(tenant_id=tenant_id)
        self.ai = AIAgents()

    def submit_assessment(self, data: Dict[str, Any]) -> int:
        """Create initial submission record and trigger background grading."""
        # Create initial result record
        submit_data = {
            "assessment_id": data["assessment_id"],
            "user_id": data["user_id"],
            "answers": data["answers"],
            "time_taken_seconds": data.get("time_taken_seconds"),
            "is_malpractice": data.get("is_malpractice", False),
            "proctoring_events": data.get("proctoring_events", []),
            "assignment_status": "submitted",
        }

        if submit_data["is_malpractice"]:
            submit_data["initial_score"] = 0.0
            submit_data["initial_feedback"] = "Terminated for Malpractice"
            submit_data["pass_status"] = False
        else:
            submit_data["initial_score"] = None
            submit_data["initial_feedback"] = "Grading in progress..."
            submit_data["pass_status"] = None

        result_id = self.repo.create_result(submit_data)

        # Start grading in background
        if not submit_data["is_malpractice"]:
            from backend.modules.verify.services.assessment_tasks import grade_assessment_task
            grade_assessment_task.delay(
                result_id, 
                data["assessment_id"], 
                data["user_id"], 
                data["answers"],
                self.tenant_id
            )

        return result_id

    def get_results_by_assessment(self, asm_id: int) -> List[Dict[str, Any]]:
        return self.repo.get_results_by_assessment(asm_id)

    def get_result_by_id(self, result_id: int) -> Optional[Dict[str, Any]]:
        return self.repo.get_result_by_id(result_id)

    def get_leaderboard(self, asm_id: int) -> List[Dict[str, Any]]:
        return self.repo.get_leaderboard(asm_id)

    def get_my_results(self, user_id: int) -> List[Dict[str, Any]]:
        return self.repo.get_my_results(user_id)

    def get_assessment_analytics(self, asm_id: int) -> Dict[str, Any]:
        return self.repo.get_assessment_analytics(asm_id)

    def release_result(self, result_id: int) -> bool:
        result = self.get_result_by_id(result_id)
        if not result:
            return False
            
        feedback_raw = result.get("feedback") or "{}"
        try:
            feedback = json.loads(feedback_raw) if isinstance(feedback_raw, str) else feedback_raw
        except Exception:
            feedback = {"raw": feedback_raw}

        feedback["_is_released"] = True
        return self.repo.update_result_feedback(result_id, json.dumps(feedback))
