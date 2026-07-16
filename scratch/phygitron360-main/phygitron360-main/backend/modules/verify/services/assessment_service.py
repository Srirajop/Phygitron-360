import logging
from typing import List, Dict, Any, Optional
from backend.modules.verify.repositories.assessment_repo import AssessmentRepository
from backend.common.services.ai.agents import AIAgents

logger = logging.getLogger(__name__)

class AssessmentService:
    def __init__(self, tenant_id: str = 'public'):
        self.tenant_id = tenant_id
        self.repo = AssessmentRepository(tenant_id=tenant_id)
        self.ai_agents = AIAgents()

    def create_assessment(self, data: Dict[str, Any]) -> int:
        return self.repo.create_assessment(data)

    def get_all_assessments(self) -> List[Dict[str, Any]]:
        return self.repo.get_all_assessments()

    def get_assessment(self, asm_id: int) -> Optional[Dict[str, Any]]:
        return self.repo.get_assessment_by_id(asm_id)

    def update_assessment(self, asm_id: int, updates: Dict[str, Any]) -> bool:
        return self.repo.update_assessment(asm_id, updates)

    def delete_assessment(self, asm_id: int) -> bool:
        return self.repo.delete_assessment(asm_id)

    def update_status(self, asm_id: int, status: str) -> bool:
        return self.repo.update_assessment_status(asm_id, status)

    def publish_assessment(self, asm_id: int) -> bool:
        return self.repo.update_assessment_status(asm_id, "active")

    async def generate_coding_meta(self, topic: str, difficulty: str = "medium") -> Dict[str, Any]:
        """Use AI to generate a complete coding question with starter code and test cases."""
        system_prompt = """You are an expert technical interviewer. Generate a coding assessment question.
Respond ONLY with JSON matching this structure:
{
  "question_text": "Detailed problem description",
  "starter_code": "def solution(n):\n    pass",
  "model_answer": "def solution(n):\n    return n * 2",
  "test_cases": [{"input": "2", "expected_output": "4"}],
  "programming_language": "python"
}"""
        prompt = f"Generate a {difficulty} coding question about {topic}."
        return await self.ai_agents.ai.generate_json(prompt, system_prompt)
