import asyncio
import json
import logging
from typing import Dict, Any

from backend.core.celery_app import celery_app
from backend.modules.verify.repositories.submission_repo import SubmissionRepository
from backend.modules.verify.repositories.assessment_repo import AssessmentRepository
from backend.common.services.ai.agents import AIAgents
from backend.modules.verify.services.sandbox_service import SandboxService

logger = logging.getLogger(__name__)

async def _async_background_grade(result_id: int, assessment_id: int, user_id: int, answers: Dict[str, Any], tenant_id: str):
    try:
        repo = SubmissionRepository(tenant_id=tenant_id)
        assessment_repo = AssessmentRepository(tenant_id=tenant_id)
        ai_agents = AIAgents()

        asm = assessment_repo.get_assessment_by_id(assessment_id)
        if not asm:
            return

        questions = asm.get("questions", [])
        pass_score = float(asm.get("pass_score", 70.0))

        total_marks = 0.0
        earned_marks = 0.0
        scores_per_q: Dict[str, Any] = {}

        for q in questions:
            qid = str(q["id"])
            candidate_answer = answers.get(qid, "")
            marks = float(q.get("marks") or 1.0)
            total_marks += marks
            q_type = (q.get("question_type") or "").lower()
            score = 0.0

            if q_type == "mcq":
                ca = str(q.get("correct_answer") or "").strip().upper()
                ans = str(candidate_answer).strip().upper()
                score = marks if ans == ca else 0.0

            elif q_type == "mcq_multi":
                correct_set = set(
                    s.strip().upper()
                    for s in str(q.get("correct_answer") or "").split(",")
                    if s.strip()
                )
                if isinstance(candidate_answer, list):
                    ans_set = {str(a).strip().upper() for a in candidate_answer}
                else:
                    ans_set = {str(candidate_answer).strip().upper()}
                score = marks if ans_set == correct_set else 0.0

            elif q_type == "coding":
                try:
                    svc = SandboxService()
                    lang = q.get("programming_language") or "python"
                    code = str(candidate_answer)
                    tc_raw = q.get("test_cases") or []
                    test_cases = tc_raw if isinstance(tc_raw, list) else json.loads(tc_raw or "[]")
                    sandbox_result = await svc.execute_code_sandbox(lang, code, "", test_cases)
                    tr = sandbox_result.get("test_results", [])
                    passed_count = sum(1 for t in tr if t.get("passed"))
                    total_count = len(tr) if tr else 1
                    score = round(marks * passed_count / total_count, 2)
                except Exception as ex:
                    logger.warning(f"Coding sandbox failed for q{qid}: {ex}")
                    score = 0.0

            elif q_type == "written":
                try:
                    grade_result = await ai_agents.ai.generate_json(
                        prompt=json.dumps({
                            "question": q.get("question_text"),
                            "model_answer": q.get("model_answer"),
                            "candidate_answer": candidate_answer,
                            "max_marks": marks,
                        }),
                        system_prompt=(
                            "You are a grading AI. Grade this written answer.\n"
                            "Respond ONLY with JSON: {\"score\": <float>, \"feedback\": \"<string>\"}"
                        ),
                    )
                    score = min(float(grade_result.get("score", 0)), marks)
                except Exception as ex:
                    logger.warning(f"Written grading failed for q{qid}: {ex}")
                    score = 0.0

            elif q_type == "file_upload":
                scores_per_q[qid] = {"score": None, "max": marks, "status": "pending_review"}
                continue

            earned_marks += score
            scores_per_q[qid] = {"score": score, "max": marks}

        pct_score = round((earned_marks / total_marks * 100) if total_marks > 0 else 0.0, 2)
        passed = pct_score >= pass_score

        # Generate AI feedback
        try:
            feedback_data = await ai_agents.generate_assessment_feedback(
                questions=questions,
                answers=answers,
                scores=scores_per_q,
                total_score=pct_score,
                passed=passed,
            )
            feedback_str = json.dumps(feedback_data)
        except Exception as e:
            logger.warning(f"AI feedback generation failed: {e}")
            feedback_str = json.dumps({"summary": "Grading complete.", "passed": passed})

        # Persist results
        repo.update_result_grading(result_id, assessment_id, user_id, scores_per_q, pct_score, passed, feedback_str)
        logger.info(f"Background grading completed successfully for result_id: {result_id}")
    except Exception as e:
        logger.error(f"Background grading failed for result {result_id}: {e}")

@celery_app.task(name="grade_assessment_task")
def grade_assessment_task(result_id: int, assessment_id: int, user_id: int, answers: Dict[str, Any], tenant_id: str):
    """Celery task to grade assessments asynchronously."""
    asyncio.run(_async_background_grade(result_id, assessment_id, user_id, answers, tenant_id))
