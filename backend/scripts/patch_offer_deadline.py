import asyncio
from app.database import engine
from sqlalchemy import text
from app.config import settings

async def patch_db():
    async with engine.begin() as conn:
        try:
            await conn.execute(text("ALTER TABLE offer_letters ADD COLUMN deadline DATETIME;"))
            print("Added deadline to offer_letters")
        except Exception as e:
            print(f"Skipping deadline on offer_letters (may already exist): {e}")

        try:
            await conn.execute(text("ALTER TABLE offer_letters ADD COLUMN reminder_sent BOOLEAN DEFAULT 0;"))
            print("Added reminder_sent to offer_letters")
        except Exception as e:
            print(f"Skipping reminder_sent on offer_letters (may already exist): {e}")

        try:
            await conn.execute(text("ALTER TABLE candidate_invites ADD COLUMN deadline DATETIME;"))
            print("Added deadline to candidate_invites")
        except Exception as e:
            print(f"Skipping deadline on candidate_invites (may already exist): {e}")

        try:
            await conn.execute(text("ALTER TABLE candidate_invites ADD COLUMN reminder_sent BOOLEAN DEFAULT 0;"))
            print("Added reminder_sent to candidate_invites")
        except Exception as e:
            print(f"Skipping reminder_sent on candidate_invites (may already exist): {e}")

if __name__ == "__main__":
    asyncio.run(patch_db())
