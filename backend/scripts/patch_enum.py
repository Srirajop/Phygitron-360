import asyncio
from app.database import engine
from sqlalchemy import text
from app.config import settings

async def patch_db():
    async with engine.begin() as conn:
        try:
            # We must specify all existing enum values plus the new one
            await conn.execute(text("ALTER TABLE offer_letters MODIFY COLUMN status ENUM('pending', 'approved', 'rejected', 'changes_requested', 'sent', 'accepted', 'declined', 'revoked') NOT NULL DEFAULT 'pending';"))
            print("Updated enum for offer_letters status")
        except Exception as e:
            print(f"Failed to update offer_letters status enum: {e}")

        try:
            await conn.execute(text("ALTER TABLE candidate_invites MODIFY COLUMN status ENUM('sent', 'opened', 'logged_in', 'completed', 'expired') NOT NULL DEFAULT 'sent';"))
            print("Updated enum for candidate_invites status")
        except Exception as e:
            print(f"Failed to update candidate_invites status enum: {e}")

if __name__ == "__main__":
    asyncio.run(patch_db())
