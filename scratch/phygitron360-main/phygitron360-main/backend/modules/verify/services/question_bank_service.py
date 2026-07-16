import logging
import json
from typing import List, Dict, Any, Optional

from backend.modules.verify.repositories.question_bank_repo import QuestionBankRepository
from backend.common.services.ai.agents import AIAgents

logger = logging.getLogger(__name__)

class QuestionBankService:
    def __init__(self, tenant_id: str = 'public'):
        self.tenant_id = tenant_id
        self.repo = QuestionBankRepository(tenant_id)
        self.ai = AIAgents()

    def create_question(self, data: Dict[str, Any]) -> int:
        return self.repo.create_question(data)

    def update_question(self, question_id: int, data: Dict[str, Any]) -> bool:
        return self.repo.update_question(question_id, data)

    def delete_question(self, question_id: int) -> bool:
        return self.repo.delete_question(question_id)

    def list_questions(self, tags: Optional[List[str]] = None, q_type: Optional[str] = None) -> List[Dict[str, Any]]:
        return self.repo.list_questions(tags, q_type)

    async def import_from_text(self, text: str, created_by: int) -> int:
        """Parse text using AI to extract questions and save them to the bank."""
        system_prompt = """You are an AI assessment generator.
Extract all questions from the given text.
For each question, determine its type (mcq, mcq_multi, written, coding), extract options if applicable, and identify the correct answer.
Respond ONLY with a JSON array of question objects:
{
  "questions": [
    {
      "question_text": "string",
      "question_type": "mcq",
      "options": ["A", "B", "C", "D"],
      "correct_answer": "A",
      "marks": 1.0,
      "tags": ["extracted"]
    }
  ]
}
"""
        result = await self.ai.ai.generate_json(text, system_prompt)
        questions = result.get("questions", [])
        
        count = 0
        for q in questions:
            q["created_by"] = created_by
            self.repo.create_question(q)
            count += 1
            
        return count
