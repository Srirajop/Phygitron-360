import asyncio
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy import text
from app.config import settings

async def main():
    engine = create_async_engine(settings.DATABASE_URL)
    async with AsyncSession(engine) as session:
        res = await session.execute(text("SELECT COUNT(*) FROM candidates WHERE created_at >= '2026-01-01'"))
        print('2026 Count:', res.scalar())
        res_all = await session.execute(text("SELECT COUNT(*) FROM candidates"))
        print('Total Count:', res_all.scalar())

asyncio.run(main())
