import asyncio
import os
from sqlalchemy import select
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from dotenv import load_dotenv
from app.models.source import Candidate
from app.models.user import User, UserRole


async def main():
    load_dotenv()
    user = os.getenv('DB_USER', 'root')
    password = os.getenv('DB_PASSWORD', 'Admin@123')
    host = os.getenv('DB_HOST', 'localhost')
    db_name = os.getenv('DB_NAME', 'phygitron360')
    db_url = f"mysql+aiomysql://{user}:{password}@{host}/{db_name}"

    engine = create_async_engine(db_url)
    Session = async_sessionmaker(engine, class_=AsyncSession)

    async with Session() as db:
        res = await db.execute(select(Candidate).where(Candidate.id == 94))
        c = res.scalar_one_or_none()
        if c:
            print(f"Candidate 94: org_id={c.org_id}, user_id={c.user_id}")
            res = await db.execute(select(User).where(User.id == c.user_id))
            u = res.scalar_one_or_none()
            if u:
                print(f"  User {u.id}: role={u.role}, org_id={u.org_id}")
            else:
                print(f"  User {c.user_id} NOT FOUND!")
        else:
            print("Candidate 94 not found in DB")






    await engine.dispose()

if __name__ == "__main__":
    asyncio.run(main())
