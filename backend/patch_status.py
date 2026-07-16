from dotenv import load_dotenv
load_dotenv()

import asyncio
from app.database import AsyncSessionLocal
from app.models.source import CandidateInvite, InviteStatus
from sqlalchemy import select, update

async def fix():
    async with AsyncSessionLocal() as db:
        res = await db.execute(select(CandidateInvite).where(CandidateInvite.candidate_id == 23))
        invites = res.scalars().all()
        for invite in invites:
            if invite.status == InviteStatus.sent:
                invite.status = InviteStatus.logged_in
        await db.commit()
        print("Updated")

if __name__ == "__main__":
    asyncio.run(fix())
