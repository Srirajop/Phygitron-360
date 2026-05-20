import asyncio
import os
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy import select
from dotenv import load_dotenv

# Import models
import sys
sys.path.append(os.getcwd())
from app.models.source import Candidate
from app.models.user import User

async def list_candidates():
    load_dotenv()
    db_url = os.getenv('DATABASE_URL')
    if not db_url:
        # Fallback to .env values
        user = os.getenv('DB_USER', 'root')
        password = os.getenv('DB_PASSWORD', '')
        host = os.getenv('DB_HOST', 'localhost')
        db_name = os.getenv('DB_NAME', 'phygitron360')
        db_url = f"mysql+aiomysql://{user}:{password}@{host}/{db_name}"

    engine = create_async_engine(db_url)
    Session = async_sessionmaker(engine, class_=AsyncSession)

    async with Session() as db:
        print("Listing all candidates:")
        result = await db.execute(select(Candidate, User).join(User, User.id == Candidate.user_id))
        for c, u in result:
            print(f"ID: {c.id}, Name: {u.full_name}, Email: {u.email}, Org ID: {c.org_id}, Status: {c.status}")


    await engine.dispose()

if __name__ == "__main__":
    asyncio.run(list_candidates())
