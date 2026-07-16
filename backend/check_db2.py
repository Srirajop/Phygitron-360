from dotenv import load_dotenv
load_dotenv()

import asyncio
from app.database import AsyncSessionLocal
from app.models.verify import AssessmentAssignment, AssessmentResult
from sqlalchemy import select

async def run():
    async with AsyncSessionLocal() as db:
        r1 = await db.execute(select(AssessmentAssignment.id, AssessmentAssignment.assessment_id, AssessmentAssignment.user_id, AssessmentAssignment.status, AssessmentAssignment.terminated_by_proctor).where(AssessmentAssignment.id == 36))
        print('Assignment 36:', r1.all())
        r2 = await db.execute(select(AssessmentResult.id, AssessmentResult.assessment_id, AssessmentResult.user_id, AssessmentResult.is_malpractice).where(AssessmentResult.assessment_id == 38))
        print('Results for assessment 38:', r2.all())

if __name__ == "__main__":
    asyncio.run(run())
