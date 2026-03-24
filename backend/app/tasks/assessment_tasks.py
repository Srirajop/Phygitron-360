import logging
import json
from app.tasks.celery_app import celery_app
from app.config import settings

logger = logging.getLogger(__name__)


@celery_app.task(bind=True, max_retries=3, default_retry_delay=60)
def grade_assessment_task(self, assessment_result_id: int):
    """Auto-grade an assessment and generate AI feedback."""
    try:
        from sqlalchemy import create_engine
        from sqlalchemy.orm import sessionmaker
        from app.models.verify import AssessmentResult, AssessmentQuestion, Assessment, AssessmentAssignment
        from app.agents.agents import run_generate_feedback_agent, run_recommend_courses_agent
        from app.models.forge import Enrollment, EnrollmentTrigger, Course
        from decimal import Decimal

        engine = create_engine(settings.SYNC_DATABASE_URL)
        Session = sessionmaker(bind=engine)
        db = Session()

        try:
            result = db.query(AssessmentResult).filter_by(id=assessment_result_id).first()
            if not result:
                return

            assessment = db.query(Assessment).filter_by(id=result.assessment_id).first()
            questions = db.query(AssessmentQuestion).filter_by(assessment_id=result.assessment_id).all()
            answers = result.answers or {}
            scores_per_q = {}
            question_data_for_feedback = []
            total_marks = 0
            earned_marks = 0

            for q in questions:
                q_id = str(q.id)
                candidate_answer = answers.get(q_id, "")
                marks = float(q.marks)
                total_marks += marks
                q_score = 0

                if q.question_type == "mcq":
                    if str(candidate_answer).strip().upper() == str(q.correct_answer).strip().upper():
                        q_score = marks
                elif q.question_type == "coding":
                    test_cases = q.test_cases or []
                    if test_cases:
                        passed = min(len(str(candidate_answer)) // 50, len(test_cases))
                        q_score = (passed / len(test_cases)) * marks
                elif q.question_type == "written":
                    # Collected for batching later
                    pass
                elif q.question_type == "file_upload":
                    scores_per_q[q_id] = {"score": None, "status": "pending_review"}
                    question_data_for_feedback.append({
                        "id": q.id, "text": q.question_text, "type": q.question_type,
                        "candidate_answer": candidate_answer, "correct_answer": q.correct_answer,
                        "marks": marks, "earned": None, "skill_id": q.skill_id,
                    })
                    continue

                scores_per_q[q_id] = {"score": q_score, "max": marks}
                earned_marks += q_score
                question_data_for_feedback.append({
                    "id": q.id, "text": q.question_text, "type": q.question_type,
                    "candidate_answer": candidate_answer, "correct_answer": q.correct_answer,
                    "marks": marks, "earned": q_score, "skill_id": q.skill_id,
                })

            # ── Batch grading for written questions ──
            written_indices = [i for i, q in enumerate(question_data_for_feedback) if q["type"] == "written"]
            if written_indices:
                try:
                    from app.agents.agents import call_llm
                    grading_batch = []
                    for idx in written_indices:
                        q_data = question_data_for_feedback[idx]
                        grading_batch.append({
                            "id": q_data["id"],
                            "question": q_data["text"],
                            "model_answer": q_data["correct_answer"] or "General knowledge",
                            "student_answer": q_data["candidate_answer"],
                            "max_marks": q_data["marks"]
                        })
                    
                    batch_system = "You are a specialized written assessment grading AI."
                    batch_prompt = f"Grade these answers. Return JSON: {{'grades': [{{'id', 'score', 'explanation'}}]}}.\n\n{json.dumps(grading_batch)}"
                    
                    batch_res = call_llm(batch_system, batch_prompt)
                    grades_map = {str(g["id"]): g for g in batch_res.get("grades", [])}
                    
                    for idx in written_indices:
                        q_data = question_data_for_feedback[idx]
                        grade = grades_map.get(str(q_data["id"]), {"score": q_data["marks"] * 0.5})
                        q_score = float(grade.get("score", 0))
                        
                        earned_marks += q_score
                        scores_per_q[str(q_data["id"])] = {"score": q_score, "max": q_data["marks"]}
                        question_data_for_feedback[idx]["earned"] = q_score
                except Exception as e:
                    logger.error(f"Async batch written grading failed: {e}")
                    for idx in written_indices:
                        q_id = str(question_data_for_feedback[idx]["id"])
                        if q_id not in scores_per_q:
                            scores_per_q[q_id] = {"score": question_data_for_feedback[idx]["marks"] * 0.5, "max": question_data_for_feedback[idx]["marks"]}
                            earned_marks += question_data_for_feedback[idx]["marks"] * 0.5
                            question_data_for_feedback[idx]["earned"] = question_data_for_feedback[idx]["marks"] * 0.5

            # Calculate final score
            pct_score = (earned_marks / total_marks * 100) if total_marks > 0 else 0
            passed = pct_score >= float(assessment.pass_score)

            # Generate AI feedback
            weak_skill_ids = []
            try:
                feedback_data = run_generate_feedback_agent(
                    questions=[{"text": q["text"], "type": q["type"]} for q in question_data_for_feedback],
                    answers={str(q["id"]): q["candidate_answer"] for q in question_data_for_feedback},
                    scores={str(q["id"]): q["earned"] for q in question_data_for_feedback},
                    total_score=round(pct_score, 2),
                    passed=passed,
                )
                feedback_text = json.dumps({
                    "summary": feedback_data.get("summary", ""),
                    "strengths": feedback_data.get("strengths", []),
                    "improvement_areas": feedback_data.get("improvement_areas", []),
                    "study_recommendations": feedback_data.get("study_recommendations", []),
                })
                weak_skill_ids = feedback_data.get("weak_skill_ids", [])
            except Exception as e:
                logger.error(f"Feedback generation failed: {e}")
                feedback_text = json.dumps({"summary": "Your results have been recorded. Please contact HR for detailed feedback.", "strengths": [], "improvement_areas": [], "study_recommendations": []})

            # Update result
            result.scores_per_question = scores_per_q
            result.score = Decimal(str(round(pct_score, 2)))
            result.pass_status = passed
            result.feedback = feedback_text
            result.weak_skill_ids = weak_skill_ids

            # Update assignment status
            assignment = db.query(AssessmentAssignment).filter_by(
                assessment_id=result.assessment_id,
                user_id=result.user_id
            ).first()
            if assignment:
                assignment.status = "graded"

            db.commit()

            # Trigger course recommendations for weak skills
            if weak_skill_ids:
                try:
                    courses = db.query(Course).filter(
                        Course.status == "published",
                        Course.org_id == assessment.org_id
                    ).all()
                    course_list = [{"id": c.id, "title": c.title, "skill_ids": c.skill_ids or [], "difficulty": c.difficulty} for c in courses]
                    recs = run_recommend_courses_agent(weak_skill_ids, course_list)
                    for rec in recs.get("recommendations", [])[:3]:
                        course_id = rec.get("course_id")
                        if course_id:
                            existing = db.query(Enrollment).filter_by(user_id=result.user_id, course_id=course_id).first()
                            if not existing:
                                enroll = Enrollment(
                                    user_id=result.user_id,
                                    course_id=course_id,
                                    triggered_by=EnrollmentTrigger.ai_gap,
                                )
                                db.add(enroll)
                    db.commit()
                except Exception as e:
                    logger.error(f"Course recommendation failed: {e}")

            logger.info(f"Assessment {assessment_result_id} graded: {round(pct_score, 2)}% - {'PASS' if passed else 'FAIL'}")

        except Exception as e:
            db.rollback()
            raise e
        finally:
            db.close()
            engine.dispose()

    except Exception as exc:
        logger.error(f"grade_assessment_task failed for result {assessment_result_id}: {exc}")
        raise self.retry(exc=exc, countdown=30 * (self.request.retries + 1))
