import asyncio
import os
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy import select
from dotenv import load_dotenv

import sys
sys.path.append(os.getcwd())
from app.models.source import Candidate
from app.models.user import User

async def test_get_candidate(cid, org_id):
    load_dotenv()
    user = os.getenv('DB_USER', 'root')
    password = os.getenv('DB_PASSWORD', '')
    host = os.getenv('DB_HOST', 'localhost')
    db_name = os.getenv('DB_NAME', 'phygitron360')
    db_url = f"mysql+aiomysql://{user}:{password}@{host}/{db_name}"

    engine = create_async_engine(db_url)
    Session = async_sessionmaker(engine, class_=AsyncSession)

    async with Session() as db:
        print(f"Testing fetch for Candidate ID {cid} with Current User Org ID {org_id}")
        result = await db.execute(select(Candidate).where(Candidate.id == cid))
        candidate = result.scalar_one_or_none()
        
        if not candidate:
            print("FAILED: Candidate not found in DB")
            return
            
        if candidate.org_id != org_id:
            print(f"FAILED: Org mismatch. Candidate Org: {candidate.org_id}, User Org: {org_id}")
            return
            
        print("SUCCESS: Candidate found and org matches.")

    await engine.dispose()

if __name__ == "__main__":
    # Test with Candidate ID 102 and Org ID 1
    asyncio.run(test_get_candidate(102, 1))
    # Test with a non-existent ID
    asyncio.run(test_get_candidate(999, 1))
