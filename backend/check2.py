import asyncio
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy import text, select
from app.models.source import Candidate, User
from app.config import settings
from datetime import datetime

async def main():
    engine = create_async_engine(settings.DATABASE_URL)
    async with AsyncSession(engine) as session:
        q = select(Candidate, User).join(User, Candidate.user_id == User.id)
        q = q.where(Candidate.created_at >= datetime(2026, 1, 1), Candidate.created_at < datetime(2027, 1, 1))
        res = await session.execute(q)
        print('Query matched:', len(res.all()))

asyncio.run(main())
