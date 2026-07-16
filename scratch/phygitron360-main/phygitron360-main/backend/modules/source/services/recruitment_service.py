import json
import logging
import uuid
import os
from datetime import datetime
from typing import List, Dict, Any, Optional
from backend.modules.source.repositories.candidate_repo import CandidateRepository
from backend.modules.source.repositories.job_role_repo import JobRoleRepository
from backend.modules.source.repositories.ai_score_repo import AIScoreRepository
from backend.common.services.ai.agents import AIAgents

logger = logging.getLogger(__name__)

class RecruitmentService:
    def __init__(self, tenant_id: str = 'public'):
        self.tenant_id = tenant_id
        self.candidate_repo = CandidateRepository(tenant_id=tenant_id)
        self.role_repo = JobRoleRepository(tenant_id=tenant_id)
        self.ai_repo = AIScoreRepository(tenant_id=tenant_id)
        self.ai_agents = AIAgents()

    async def score_candidate_fit(self, candidate_id: int, role_id: int):
        """AI Scoring of a candidate against a specific job role requirements."""
        candidate = self.candidate_repo.get_candidate_by_id(candidate_id)
        role = self.role_repo.get_job_role_by_id(role_id)
        
        if not candidate or not role:
            raise ValueError("Candidate or Role not found")

        # Prepare candidate profile with skills
        primary = candidate.get("primary_skills") or []
        secondary = candidate.get("secondary_skills") or []
        candidate['skills_list'] = [{"name": s, "level": "intermediate"} for s in primary] + [{"name": s, "level": "beginner"} for s in secondary]
        
        # Run AI Agent for scoring
        ai_result = await self.ai_agents.score_role_fit(candidate, role)

        # Store AI Score in DB
        self.ai_repo.create_ai_score({
            "entity_type": "candidate",
            "entity_id": candidate_id,
            "job_role_id": role_id,
            "score_type": "role_fit",
            "score": ai_result.get("score", 0),
            "reasoning": json.dumps(ai_result)
        })

        return ai_result

    async def auto_rank_all_candidates(self, role_id: int):
        """Automatically scan and rank ALL candidates in the pool for this role."""
        import asyncio
        candidates = self.candidate_repo.get_all_candidates(page=1, page_size=1000) # Get all
        
        results = []
        # We can run these in parallel, but let's be mindful of rate limits
        # Using a semaphore or chunking if needed
        tasks = [self.score_candidate_fit(c['id'], role_id) for c in candidates]
        
        # Process in chunks of 5 to avoid overloading the AI service
        chunk_size = 5
        for i in range(0, len(tasks), chunk_size):
            chunk = tasks[i:i + chunk_size]
            chunk_results = await asyncio.gather(*chunk, return_exceptions=True)
            results.extend(chunk_results)
            
        return {"success": True, "processed": len(results)}

    def send_invite(self, candidate_id: int, role_id: int, hr_user_id: int):
        """Send an invite to a candidate for the Talent Portal."""
        candidate = self.candidate_repo.get_candidate_by_id(candidate_id)
        if not candidate:
            raise ValueError("Candidate not found")
            
        temp_pass = str(uuid.uuid4())[:12]
        
        invite_id = self.role_repo.create_candidate_invite({
            "candidate_id": candidate_id,
            "job_role_id": role_id,
            "hr_user_id": hr_user_id,
            "temp_password_hash": temp_pass, # In real app, hash this properly
            "email_sent_at": datetime.now()
        })
        
        # In a real app, integrate an email service here.
        logger.info(f"Invite sent to {candidate['email']} for role {role_id}. Pass: {temp_pass}")
        
        return {"success": True, "invite_id": invite_id, "temp_pass": temp_pass}

    async def generate_offer_preview(self, candidate_id: int, output_path: str):
        """Generate a personalized PDF offer letter preview using AI."""
        candidate = self.candidate_repo.get_candidate_by_id(candidate_id)
        if not candidate:
            raise ValueError("Candidate not found")

        details = {
            "role": candidate.get('current_designation') or "New Joiner",
            "experience": candidate.get('total_experience_years', 0),
            "location": candidate.get('location') or "Remote"
        }
        
        ai_content = await self.ai_agents.generate_offer_letter(candidate['full_name'], details)
        
        # Generate the professional PDF
        from backend.common.utils.pdf_utils import generate_professional_offer_pdf
        generate_professional_offer_pdf(ai_content, output_path)
        
        return {"success": True, "pdf_path": output_path, "content": ai_content}

    def convert_candidate_to_employee(self, candidate_id: int, employee_code: str, doj: str):
        """The 'Bridge' logic that migrates a candidate into the HRMS ecosystem (Deploy module)."""
        candidate = self.candidate_repo.get_candidate_by_id(candidate_id)
        if not candidate:
            raise ValueError("Candidate not found")

        from backend.modules.deploy.services.employee_service import EmployeeService
        emp_service = EmployeeService(tenant_id=self.tenant_id)
        
        # Prepare employee record from parsed candidate profile
        emp_data = {
            "code": employee_code,
            "name": candidate['full_name'],
            "email": candidate['email'],
            "phone": candidate['phone'],
            "doj": doj,
            "role": candidate['current_designation'] or "New Joiner",
            "location": candidate['location'] or "Remote",
            "experience_years": candidate['total_experience_years'],
            "cv_path": candidate['resume_path'],
            "status": "Active"
        }

        # Create record in Deploy module
        emp_service.create_employee(emp_data)

        # Update candidate status in Source module
        self.candidate_repo.update_candidate_status(candidate_id, "Hired")
        
        return {"success": True, "message": f"Candidate successfully converted to Employee {employee_code}"}
    
    def get_candidate_rankings(self, role_id: int) -> List[Dict[str, Any]]:
        """Returns candidates ranked by AI score for a specific role."""
        return self.ai_repo.get_ranked_candidates_for_role(role_id)
