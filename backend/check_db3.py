from dotenv import load_dotenv
load_dotenv()

import asyncio
from app.database import AsyncSessionLocal
from app.models.verify import AssessmentAssignment, AssessmentResult
from sqlalchemy import select

async def run():
    async with AsyncSessionLocal() as db:
        r1 = await db.execute(select(AssessmentAssignment.id, AssessmentAssignment.assessment_id, AssessmentAssignment.user_id, AssessmentAssignment.status).where(AssessmentAssignment.assessment_id == 38, AssessmentAssignment.user_id == 30))
        print('Assignments for user 30, asm 38:', r1.all())

if __name__ == "__main__":
    asyncio.run(run())
