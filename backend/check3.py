import asyncio
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy import text
from app.config import settings
from datetime import datetime

async def main():
    engine = create_async_engine(settings.DATABASE_URL)
    async with AsyncSession(engine) as session:
        start_date = datetime(2026, 1, 1)
        end_date = datetime(2027, 1, 1)
        res = await session.execute(text("SELECT COUNT(*) FROM candidates WHERE created_at >= :start AND created_at < :end"), {'start': start_date, 'end': end_date})
        print('2026 ORM-like Count:', res.scalar())
asyncio.run(main())
