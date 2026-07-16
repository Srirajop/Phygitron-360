import asyncio
from app.database import engine
from sqlalchemy import text
from app.models.source import InviteStatus

async def main():
    async with engine.begin() as conn:
        print("Adding invite_content column...")
        try:
            await conn.execute(text("ALTER TABLE candidate_invites ADD COLUMN invite_content JSON NULL;"))
            print("Successfully added invite_content.")
        except Exception as e:
            print(f"Column might already exist: {e}")
            
        print("Modifying status column to VARCHAR...")
        try:
            await conn.execute(text("ALTER TABLE candidate_invites MODIFY COLUMN status VARCHAR(50) DEFAULT 'sent';"))
            print("Successfully modified status to VARCHAR.")
        except Exception as e:
            print(f"Failed to modify status: {e}")

asyncio.run(main())
