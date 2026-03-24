import logging
from app.tasks.celery_app import celery_app
from app.config import settings

logger = logging.getLogger(__name__)


@celery_app.task(bind=True, max_retries=3)
def skill_decay_check_task(self):
    """Daily job: flag decayed skills and notify employees."""
    try:
        from sqlalchemy import create_engine
        from sqlalchemy.orm import sessionmaker
        from app.models.deploy import EmployeeSkill, Employee
        from app.models.user import User
        from datetime import datetime, timedelta

        engine = create_engine(settings.SYNC_DATABASE_URL)
        Session = sessionmaker(bind=engine)
        db = Session()

        try:
            cutoff = datetime.utcnow() - timedelta(days=180)
            skills = db.query(EmployeeSkill).filter(
                EmployeeSkill.last_verified_at <= cutoff,
                EmployeeSkill.decayed == False,
            ).all()

            level_order = ["expert", "advanced", "intermediate", "beginner"]
            for skill in skills:
                skill.decayed = True
                # Downgrade level if not already beginner
                current_idx = level_order.index(skill.level.value) if hasattr(skill.level, 'value') else level_order.index(str(skill.level))
                if current_idx < len(level_order) - 1:
                    skill.level = level_order[current_idx + 1]

            db.commit()
            logger.info(f"Skill decay check complete: {len(skills)} skills marked as decayed")

        finally:
            db.close()
            engine.dispose()

    except Exception as exc:
        logger.error(f"skill_decay_check_task failed: {exc}")
        raise self.retry(exc=exc)


@celery_app.task(bind=True, max_retries=3)
def capability_index_update_task(self, entity_type: str, entity_id: int):
    """Recalculate and store Capability Index for a candidate or employee."""
    try:
        from sqlalchemy import create_engine, func
        from sqlalchemy.orm import sessionmaker
        from app.models.deploy import Employee, EmployeeSkill
        from app.models.verify import AssessmentResult
        from app.models.forge import Enrollment
        from app.models.ai_score import AIScore, EntityType, ScoreType
        from decimal import Decimal
        from datetime import datetime, timedelta
        import json

        engine = create_engine(settings.SYNC_DATABASE_URL)
        Session = sessionmaker(bind=engine)
        db = Session()

        try:
            level_map = {"beginner": 1, "intermediate": 2, "advanced": 3, "expert": 4}

            if entity_type == "employee":
                emp = db.query(Employee).filter_by(id=entity_id).first()
                if not emp:
                    return

                skills = db.query(EmployeeSkill).filter_by(employee_id=entity_id).all()
                skill_count = len(skills)
                avg_depth = sum(level_map.get(str(s.level).split(".")[-1], 1) for s in skills) / max(skill_count, 1)
                breadth_score = min(skill_count / 20 * 100, 100)
                depth_score = (avg_depth / 4) * 100

                results = db.query(AssessmentResult).filter_by(user_id=emp.user_id).all()
                avg_assessment = sum(float(r.score) for r in results if r.score is not None) / max(len(results), 1)

                cutoff_90 = datetime.utcnow() - timedelta(days=90)
                recent_courses = db.query(Enrollment).filter(
                    Enrollment.user_id == emp.user_id,
                    Enrollment.completed_at >= cutoff_90,
                ).count()
                learning_score = min(recent_courses / 5 * 100, 100)

                fresh_skills = sum(1 for s in skills if not s.decayed)
                deployability_score = (fresh_skills / max(skill_count, 1)) * 100 if skill_count > 0 else 0

                capability_index = (
                    breadth_score * 0.20
                    + depth_score * 0.25
                    + avg_assessment * 0.25
                    + learning_score * 0.15
                    + deployability_score * 0.15
                )

                # Upsert AI score
                existing = db.query(AIScore).filter_by(
                    entity_type=EntityType.employee,
                    entity_id=entity_id,
                    score_type=ScoreType.capability_index
                ).first()
                if existing:
                    existing.score = Decimal(str(round(capability_index, 2)))
                    existing.reasoning = json.dumps({
                        "breadth": round(breadth_score, 2),
                        "depth": round(depth_score, 2),
                        "assessment": round(avg_assessment, 2),
                        "learning": round(learning_score, 2),
                        "deployability": round(deployability_score, 2),
                    })
                    existing.computed_at = datetime.utcnow()
                else:
                    score = AIScore(
                        entity_type=EntityType.employee,
                        entity_id=entity_id,
                        score_type=ScoreType.capability_index,
                        score=Decimal(str(round(capability_index, 2))),
                        reasoning=json.dumps({"breadth": round(breadth_score, 2)}),
                    )
                    db.add(score)

                db.commit()
                logger.info(f"Capability index updated for employee {entity_id}: {round(capability_index, 2)}")

        finally:
            db.close()
            engine.dispose()

    except Exception as exc:
        logger.error(f"capability_index_update_task failed: {exc}")
        raise self.retry(exc=exc)
