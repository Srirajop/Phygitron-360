"""
Quick script to enable all modules for all existing organisations.
Run: python scripts/enable_modules.py
"""
import asyncio
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy import select, update
from app.config import settings
from app.models.organisation import Organisation


async def enable_all_modules():
    engine = create_async_engine(settings.DATABASE_URL, echo=False)
    Session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with Session() as db:
        result = await db.execute(select(Organisation))
        orgs = result.scalars().all()
        
        for org in orgs:
            org.has_source = True
            org.has_verify = True
            org.has_forge = True
            org.has_deploy = True
            print(f"[OK] Enabled all modules for org: {org.name} (id={org.id})")
        
        await db.commit()
        print(f"\nDone! Updated {len(orgs)} organisation(s).")

    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(enable_all_modules())
