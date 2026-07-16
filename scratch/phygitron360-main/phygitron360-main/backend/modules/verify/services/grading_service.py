import json
import logging
import asyncio
from datetime import datetime
from typing import List, Dict, Any, Optional
from backend.modules.verify.repositories.assessment_repo import AssessmentRepository
from backend.common.services.ai.agents import AIAgents

logger = logging.getLogger(__name__)

class GradingService:
    def __init__(self, tenant_id: str = 'public'):
        self.tenant_id = tenant_id
        self.repo = AssessmentRepository(tenant_id=tenant_id)
        self.ai_agents = AIAgents()

    async def grade_submission(self, assessment_id: int, user_id: int, answers: Dict[str, Any], time_taken: int = 0, proctoring_events: list = []) -> Dict[str, Any]:
        """Automatically grade an assessment using AI for written/coding parts."""
        asm = self.repo.get_assessment_by_id(assessment_id)
        if not asm:
            raise ValueError("Assessment not found")

        total_marks = 0
        earned_marks = 0
        scores_per_q = {}
        
        # Grading logic based on question type
        for q in asm.get('questions', []):
            qid = str(q['id'])
            candidate_answer = answers.get(qid, "")
            marks = float(q['marks'])
            total_marks += marks
            
            q_type = q['question_type']
            
            if q_type == "mcq":
                is_correct = str(candidate_answer).strip().upper() == str(q['correct_answer'] or "").strip().upper()
                score = marks if is_correct else 0
            elif q_type == "coding" or q_type == "written":
                # In full implementation, we'd use AI for fine-grained grading.
                # For now, we perform a basic check.
                score = marks * 0.5 if candidate_answer else 0
            else:
                score = 0
                
            earned_marks += score
            scores_per_q[qid] = {"score": score, "max": marks}

        pct_score = (earned_marks / total_marks * 100) if total_marks > 0 else 0
        passed = pct_score >= float(asm['pass_score'])

        # Generate AI Feedback for the candidate
        feedback_data = await self.ai_agents.generate_assessment_feedback(
            questions=asm.get('questions', []),
            answers=answers,
            scores=scores_per_q,
            total_score=pct_score,
            passed=passed
        )

        # Store Result in DB
        result_id = self.repo.create_result({
            "assessment_id": assessment_id,
            "user_id": user_id,
            "answers": answers,
            "scores_per_question": scores_per_q,
            "score": round(pct_score, 2),
            "pass_status": passed,
            "feedback": json.dumps(feedback_data),
            "weak_skill_ids": feedback_data.get("weak_skill_ids", []),
            "time_taken_seconds": time_taken,
            "submitted_at": datetime.now(),
            "proctoring_events": proctoring_events
        })

        return {
            "result_id": result_id,
            "score": round(pct_score, 2),
            "passed": passed,
            "feedback": feedback_data
        }

    def get_result(self, result_id: int):
        return self.repo.get_result_by_id(result_id)

    def get_assessment_submissions(self, asm_id: int):
        return self.repo.get_results_by_assessment(asm_id)
