import json
import logging
import secrets
from typing import List, Dict, Any, Optional
from datetime import datetime

from backend.modules.source.repositories.job_role_repo import JobRoleRepository
from backend.modules.source.repositories.candidate_repo import CandidateRepository
from backend.modules.source.repositories.ai_score_repo import AIScoreRepository
from backend.modules.source.services.ats_engine import normalise_required_skills, calculate_role_fit
from backend.common.services.ai.agents import AIAgents
from backend.core.email_service_extended import send_invite_email

logger = logging.getLogger(__name__)

class JobService:
    def __init__(self, tenant_id: str = "public"):
        self.tenant_id = tenant_id
        self.repo = JobRoleRepository(tenant_id=tenant_id)
        self.candidate_repo = CandidateRepository(tenant_id=tenant_id)
        self.ai_score_repo = AIScoreRepository(tenant_id=tenant_id)
        self.ai_agents = AIAgents()

    def get_all_job_roles(self) -> List[Dict[str, Any]]:
        return self.repo.get_all_job_roles()

    async def create_job_role(self, data: Dict[str, Any]) -> int:
        required_skills = data.get("required_skills")
        description = data.get("description")
        title = data.get("title")

        # If no skills explicitly provided, try to infer from title only (no description)
        if not required_skills:
            required_skills = normalise_required_skills(None, title=title, description="")

        data["required_skills"] = required_skills or []
        role_id = self.repo.create_job_role(data)

        # Fire background scoring task immediately after creation
        try:
            import os
            from backend.modules.source.services.ats_tasks import score_all_candidates_for_role, _run_score_all_candidates_for_role
            
            redis_url = os.getenv("REDIS_URL", "redis://localhost:6379/0")
            if "localhost" in redis_url:
                import asyncio
                # Run purely in background thread to avoid 10s Celery/Redis connection timeout
                asyncio.get_running_loop().run_in_executor(
                    None, _run_score_all_candidates_for_role, role_id, self.tenant_id
                )
                logger.info(f"[ATS] Queued bulk scoring as local thread for role {role_id} in tenant {self.tenant_id}")
            else:
                score_all_candidates_for_role.delay(role_id, self.tenant_id)
                logger.info(f"[ATS] Queued bulk scoring via Celery for role {role_id} in tenant {self.tenant_id}")
        except Exception as exc:
            logger.warning(f"[ATS] Failed to queue scoring task for role {role_id}: {exc}")

        return role_id

    async def update_job_role(self, role_id: int, updates: Dict[str, Any]) -> bool:
        skills_updated = "required_skills" in updates

        # The database repository expects a JSON string for the required_skills JSONB column
        if "required_skills" in updates and isinstance(updates["required_skills"], list):
            import json
            updates["required_skills"] = json.dumps(updates["required_skills"])

        result = self.repo.update_job_role(role_id, updates)

        # Auto re-score all candidates if required_skills were changed
        if result and skills_updated:
            try:
                import os
                from backend.modules.source.services.ats_tasks import score_all_candidates_for_role, _run_score_all_candidates_for_role
                
                redis_url = os.getenv("REDIS_URL", "redis://localhost:6379/0")
                if "localhost" in redis_url:
                    import asyncio
                    asyncio.get_running_loop().run_in_executor(
                        None, _run_score_all_candidates_for_role, role_id, self.tenant_id
                    )
                    logger.info(f"[ATS] Queued re-scoring as local thread for updated role {role_id} in tenant {self.tenant_id}")
                else:
                    score_all_candidates_for_role.delay(role_id, self.tenant_id)
                    logger.info(f"[ATS] Queued re-scoring via Celery for updated role {role_id} in tenant {self.tenant_id}")
            except Exception as exc:
                logger.warning(f"[ATS] Failed to queue re-scoring task for role {role_id}: {exc}")

        return result

    def delete_job_role(self, role_id: int) -> bool:
        return self.repo.delete_job_role(role_id)

    def delete_all_job_roles(self):
        self.repo.delete_all_job_roles()

    def get_candidate_rankings(self, role_id: int) -> List[Dict[str, Any]]:
        return self.repo.get_candidate_rankings(role_id)

    def _score_candidate(self, candidate: Dict[str, Any], req_skills: List[Dict], min_exp: int, role_id: int) -> Dict[str, Any]:
        cid = candidate["id"]
        exp = int(candidate.get("total_experience_years") or 0)
        
        # Load candidate details to get primary/secondary skills
        cand_db = self.candidate_repo.get_candidate_by_id(cid)
        primary = (cand_db.get("primary_skills") or []) if cand_db else []
        secondary = (cand_db.get("secondary_skills") or []) if cand_db else []
        cand_skills = [{"name": s, "level": "intermediate"} for s in primary] + [{"name": s, "level": "beginner"} for s in secondary]
        
        fit = calculate_role_fit(cand_skills, req_skills, exp_years=exp, min_exp=min_exp)
        
        reasoning = json.dumps({
            "matched": fit["matched_skills"],
            "missing": fit["missing_skills"],
        })
        
        try:
            self.ai_score_repo.upsert_role_fit_score(cid, role_id, fit["score"], reasoning)
        except Exception:
            self.ai_score_repo.create_ai_score({
                "entity_type": "candidate",
                "entity_id": cid,
                "job_role_id": role_id,
                "score_type": "role_fit",
                "score": fit["score"],
                "reasoning": reasoning,
            })
        
        # Log activity in candidate timeline
        try:
            role = self.repo.get_job_role_by_id(role_id)
            role_title = role.get("title") if role else f"ID: {role_id}"
            self.candidate_repo.log_activity(cid, 'System', 'jd_matched', f"ATS Score computed for role: {role_title}")
        except Exception as e:
            logger.warning(f"Failed to log jd_matched activity: {e}")
            
        return {"candidate_id": cid, "score": fit["score"], "detail": fit}

    def auto_rank_candidates(self, role_id: int) -> List[Dict[str, Any]]:
        role = self.repo.get_job_role_by_id(role_id)
        if not role:
            raise ValueError("Job role not found")

        req_skills = normalise_required_skills(
            role["required_skills"],
            title=role.get("title") or "",
            description=role.get("description") or "",
        )
        min_exp = role.get("min_experience") or 0

        candidates = self.repo.get_all_candidates_for_scoring()
        results = []
        for cand in candidates:
            try:
                res = self._score_candidate(cand, req_skills, min_exp, role_id)
                results.append({"candidate_id": cand["id"], "score": res["score"]})
            except Exception as e:
                logger.error(f"Failed scoring candidate {cand['id']}: {e}")
                
        return results

    def score_selected_candidates(self, role_id: int, candidate_ids: List[int]) -> List[Dict[str, Any]]:
        role = self.repo.get_job_role_by_id(role_id)
        if not role:
            raise ValueError("Job role not found")

        req_skills = normalise_required_skills(
            role["required_skills"],
            title=role.get("title") or "",
            description=role.get("description") or "",
        )
        min_exp = role.get("min_experience") or 0
        
        results = []
        for cid in candidate_ids:
            cand = self.repo.get_candidate_for_scoring(cid)
            if not cand:
                results.append({"candidate_id": cid, "error": "Candidate not found"})
                continue
                
            try:
                res = self._score_candidate(cand, req_skills, min_exp, role_id)
                results.append(res)
            except Exception as exc:
                logger.error(f"Scoring failed for candidate {cid}: {exc}")
                results.append({"candidate_id": cid, "error": str(exc)})
                
        return results

    def send_invites(
        self,
        role_id: int,
        hr_id: int,
        candidate_ids: List[int],
        email_addresses: Optional[List[str]] = None,
        deadline: Optional[str] = None,
        subject: Optional[str] = None,
        custom_body: Optional[str] = None
    ) -> Dict[str, Any]:
        role_name = "Trainee Pipeline"
        if role_id is not None:
            role = self.repo.get_job_role_by_id(role_id)
            if not role:
                raise ValueError("Job role not found")
            role_name = role["title"]
        sent_count = 0
        errors = []
        
        from backend.core.security import hash_password
        import os
        base_url = os.getenv("APP_BASE_URL", "http://localhost:5173")
        portal_link = f"{base_url}/login"

        for i, cid in enumerate(candidate_ids):
            try:
                cand = self.candidate_repo.get_candidate_by_id(cid)
                if not cand:
                    errors.append({"candidate_id": cid, "error": "Not found"})
                    continue
                    
                temp_password = secrets.token_urlsafe(10)
                to_email = email_addresses[i] if email_addresses and i < len(email_addresses) else cand["email"]

                is_internal = False
                user_id = None
                try:
                    res = self.repo.upsert_user_password_by_candidate(cid, hash_password(temp_password))
                    if res and res.get("success"):
                        is_internal = res.get("is_internal")
                        user_id = res.get("user_id")
                except Exception as ex:
                    logger.error(f"Failed to upsert user password for candidate {cid}: {ex}")

                if role_id is not None:
                    self.repo.create_invite_if_not_exists(cid, role_id, hr_id)
                self.candidate_repo.update_candidate_status(cid, "Invited", role_id=role_id)

                # Auto-assign latest active assessment
                if user_id:
                    try:
                        from backend.core.database import get_db_connection
                        from psycopg2.extras import RealDictCursor
                        with get_db_connection() as asm_conn:
                            with asm_conn.cursor(cursor_factory=RealDictCursor) as asm_cur:
                                asm_cur.execute("SELECT id FROM assessments WHERE status='active' ORDER BY id DESC LIMIT 1")
                                asm = asm_cur.fetchone()
                                if asm:
                                    asm_cur.execute("SELECT 1 FROM assessment_assignments WHERE assessment_id=%s AND user_id=%s", (asm['id'], user_id))
                                    if not asm_cur.fetchone():
                                        asm_cur.execute(
                                            "INSERT INTO assessment_assignments (assessment_id, user_id, assigned_by) VALUES (%s, %s, %s)",
                                            (asm['id'], user_id, hr_id)
                                        )
                            asm_conn.commit()
                    except Exception as asm_ex:
                        import logging
                        logging.getLogger(__name__).error(f"Auto-assign assessment failed: {asm_ex}")

                # Format custom templates candidate-by-candidate
                cand_subject = subject
                cand_body = custom_body

                if cand_subject:
                    cand_subject = cand_subject.replace("{candidate_name}", cand["full_name"])\
                                               .replace("{role}", role_name)\
                                               .replace("{org_name}", "Phygitron 360")

                if cand_body:
                    cand_body = cand_body.replace("{candidate_name}", cand["full_name"])\
                                         .replace("{role}", role_name)\
                                         .replace("{org_name}", "Phygitron 360")\
                                         .replace("{assessment_link}", portal_link)\
                                         .replace("{temp_password}", temp_password)

                if is_internal:
                    # Internal employee notification
                    from backend.core.email_service_extended import send_email
                    try:
                        send_email(
                            to_email=to_email,
                            subject=f"Internal Application Update: {role_name}",
                            body_html=f"""
                                <h2>Internal Application Update</h2>
                                <p>Hi {cand['full_name']},</p>
                                <p>Your application for <strong>{role_name}</strong> has advanced to the next stage.</p>
                                <p>Please log in to your Employee Central dashboard and check the "My Opportunities" tab for any pending assessments or updates.</p>
                                <p>{cand_body or ''}</p>
                            """
                        )
                    except Exception as exc:
                        logger.warning(f"Internal invite email failed for {to_email}: {exc}")
                        
                    # System notification
                    try:
                        from backend.modules.admin.repositories.notification_repo import NotificationRepository
                        if user_id:
                            notif_repo = NotificationRepository()
                            notif_repo.create_notification(
                                user_id=user_id,
                                tenant_id=cand.get("tenant_id") or "public",
                                title=f"Application Update: {role_name}",
                                message=f"You have been invited to the next stage for the {role_name} role. Check your My Opportunities tab.",
                                type="alert"
                            )
                    except Exception as e:
                        logger.error(f"Failed to create system notification: {e}")
                else:
                    # External Candidate email
                    try:
                        send_invite_email(
                            to_email=to_email,
                            candidate_name=cand["full_name"],
                            role_name=role_name,
                            company_name="Phygitron 360",
                            temp_password=temp_password,
                            deadline=deadline,
                            custom_subject=cand_subject,
                            custom_body=cand_body
                        )
                    except Exception as exc:
                        logger.warning(f"Invite email failed for {to_email}: {exc}")

                # Log activity in candidate timeline
                self.candidate_repo.log_activity(cid, 'HR', 'invite_sent', f"Invited to apply for {role_name}")

                sent_count += 1
            except Exception as exc:
                logger.error(f"Invite failed for candidate {cid}: {exc}")
                errors.append({"candidate_id": cid, "error": str(exc)})
                
        return {"sent": sent_count, "errors": errors}

    def cancel_invites(self, candidate_ids: List[int]) -> Dict[str, Any]:
        cancelled_count = 0
        errors = []
        for cid in candidate_ids:
            try:
                res = self.repo.cancel_invite(cid)
                if res.get("success"):
                    self.candidate_repo.log_activity(cid, 'HR', 'invite_cancelled', "Invite cancelled and account unlinked")
                    cancelled_count += 1
                else:
                    errors.append({"candidate_id": cid, "error": res.get("error", "Failed")})
            except Exception as exc:
                logger.error(f"Cancel invite failed for candidate {cid}: {exc}")
                errors.append({"candidate_id": cid, "error": str(exc)})
                
        return {"cancelled": cancelled_count, "errors": errors}

    def get_invite_status(self, job_role_id: int) -> List[Dict[str, Any]]:
        return self.repo.get_invite_status(job_role_id)
