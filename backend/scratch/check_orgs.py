import asyncio
import os
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy import select
from dotenv import load_dotenv

import sys
sys.path.append(os.getcwd())
from app.models.source import Candidate

async def main():
    load_dotenv()
    user = os.getenv('DB_USER', 'root')
    password = os.getenv('DB_PASSWORD', '')
    host = os.getenv('DB_HOST', 'localhost')
    db_name = os.getenv('DB_NAME', 'phygitron360')
    db_url = f"mysql+aiomysql://{user}:{password}@{host}/{db_name}"

    engine = create_async_engine(db_url)
    Session = async_sessionmaker(engine, class_=AsyncSession)

    async with Session() as db:
        res = await db.execute(select(Candidate.org_id).distinct())
        print(f"Distinct Org IDs in Candidate table: {res.scalars().all()}")

    await engine.dispose()

if __name__ == "__main__":
    asyncio.run(main())
