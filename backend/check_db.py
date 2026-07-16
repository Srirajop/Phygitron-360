from dotenv import load_dotenv
load_dotenv()

import asyncio
from app.database import AsyncSessionLocal
from app.models.verify import AssessmentAssignment, AssessmentResult
from sqlalchemy import select

async def run():
    async with AsyncSessionLocal() as db:
        r1 = await db.execute(select(AssessmentAssignment.id, AssessmentAssignment.status, AssessmentAssignment.terminated_by_proctor))
        print('Assignments:', r1.all())
        r2 = await db.execute(select(AssessmentResult.id, AssessmentResult.is_malpractice))
        print('Results:', r2.all())

if __name__ == "__main__":
    asyncio.run(run())
