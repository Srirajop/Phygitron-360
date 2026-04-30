import logging
from app.tasks.celery_app import celery_app
from app.config import settings

logger = logging.getLogger(__name__)


def _clean_confidence_signals(signals):
    """Keep confidence notes useful for recruiters and remove repeated AI boilerplate."""
    cleaned = []
    seen = set()

    for signal in signals or []:
        skill = str(signal.get("skill") or "").strip()
        if not skill:
            continue

        key = skill.lower()
        if key in seen:
            continue
        seen.add(key)

        reason = str(signal.get("reason") or "").strip()
        generic_reasons = (
            f"no evidence of {skill.lower()} usage in project descriptions or work history",
            f"no evidence of {skill.lower()} usage in projects or work history",
        )
        if reason.lower() in generic_reasons:
            reason = "Claimed in the resume, but the parser did not find a concrete project, employer, or deliverable that proves hands-on use."

        cleaned.append({
            "skill": skill,
            "claimed_years": signal.get("claimed_years") or 0,
            "supported_years": signal.get("supported_years") or 0,
            "flag": bool(signal.get("flag")),
            "reason": reason[:260],
        })

        if len(cleaned) >= 5:
            break

    return cleaned


@celery_app.task(bind=True, max_retries=3, default_retry_delay=60)
def parse_resume_task(self, candidate_id: int, extracted_text: str, org_id: int):
    """Parse resume text with AI and store skill graph."""
    try:
        from sqlalchemy import create_engine
        from sqlalchemy.orm import sessionmaker
        from app.models.source import Candidate, CandidateSkill, SkillGraphEdge, CandidateStatus
        from app.models.skill_taxonomy import SkillTaxonomy
        from app.models.ai_score import AIScore, EntityType, ScoreType
        from app.agents.agents import run_parse_resume_agent
        import json
        from datetime import datetime

        engine = create_engine(settings.SYNC_DATABASE_URL)
        Session = sessionmaker(bind=engine)
        db = Session()

        try:
            # Run the AI agent
            result = run_parse_resume_agent(extracted_text)

            # Process skills
            for skill_data in result.get("skills", []):
                normalized = skill_data.get("normalized_name", "").lower().strip()
                if not normalized:
                    continue

                # Look up or create in skill_taxonomy
                existing = db.query(SkillTaxonomy).filter_by(normalized_name=normalized).first()
                if not existing:
                    existing = SkillTaxonomy(
                        name=skill_data.get("name", normalized),
                        normalized_name=normalized,
                        category="extracted",
                        aliases=[skill_data.get("name", normalized)],
                    )
                    db.add(existing)
                    db.flush()

                # Map level
                level_map = {"beginner": "beginner", "intermediate": "intermediate", "advanced": "advanced", "expert": "expert"}
                level = level_map.get(skill_data.get("level", "beginner"), "beginner")

                # Upsert candidate_skill
                cs = db.query(CandidateSkill).filter_by(candidate_id=candidate_id, skill_id=existing.id).first()
                if not cs:
                    cs = CandidateSkill(
                        candidate_id=candidate_id,
                        skill_id=existing.id,
                        level=level,
                        source="resume",
                        years_of_use=skill_data.get("years_of_use"),
                        evidence=skill_data.get("evidence"),
                    )
                    db.add(cs)

            db.flush()

            # Process skill graph edges
            skill_lookup = {s.normalized_name: s.id for s in db.query(SkillTaxonomy).all()}
            for rel in result.get("relationships", []):
                from_id = skill_lookup.get(rel.get("from", "").lower())
                to_id = skill_lookup.get(rel.get("to", "").lower())
                relation = rel.get("relation", "requires")
                if from_id and to_id and from_id != to_id:
                    existing_edge = db.query(SkillGraphEdge).filter_by(
                        from_skill_id=from_id, to_skill_id=to_id, relation=relation
                    ).first()
                    if not existing_edge:
                        edge = SkillGraphEdge(from_skill_id=from_id, to_skill_id=to_id, relation=relation)
                        db.add(edge)

            # Update candidate
            candidate = db.query(Candidate).filter_by(id=candidate_id).first()
            if candidate:
                candidate.status = CandidateStatus.active
                candidate.exp_years = result.get("experience_years_total", 0)
                if result.get("location"):
                    candidate.location = result["location"]
                if result.get("availability"):
                    candidate.availability = result["availability"]

            # Store confidence signals
            confidence_signals = _clean_confidence_signals(result.get("confidence_signals", []))
            if confidence_signals:
                score = AIScore(
                    entity_type=EntityType.candidate,
                    entity_id=candidate_id,
                    score_type=ScoreType.confidence_signals,
                    reasoning=json.dumps(confidence_signals),
                )
                db.add(score)

            db.commit()
            logger.info(f"Resume parsed successfully for candidate {candidate_id}")

        except Exception as e:
            db.rollback()
            # Mark candidate as parse_failed
            candidate = db.query(Candidate).filter_by(id=candidate_id).first()
            if candidate:
                candidate.status = CandidateStatus.parse_failed
                db.commit()
            raise e
        finally:
            db.close()
            engine.dispose()

    except Exception as exc:
        logger.error(f"parse_resume_task failed for candidate {candidate_id}: {exc}")
        raise self.retry(exc=exc, countdown=60 * (self.request.retries + 1))
