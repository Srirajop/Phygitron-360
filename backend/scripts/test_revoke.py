import asyncio
from sqlalchemy import select
from app.database import AsyncSessionLocal
from app.models.source import OfferLetter, Candidate, OfferStatus, CandidateStatus

async def test_revoke(offer_id: int):
    async with AsyncSessionLocal() as db:
        offer = await db.execute(select(OfferLetter).where(OfferLetter.id == offer_id))
        offer = offer.scalar_one_or_none()
        if not offer:
            print("Offer not found")
            return
            
        print(f"Offer found. Status: {offer.status}")
        
        offer.status = OfferStatus.revoked
        
        cand_res = await db.execute(select(Candidate).where(Candidate.id == offer.candidate_id))
        candidate = cand_res.scalar_one_or_none()
        if candidate:
            print(f"Candidate found. Status: {candidate.status}")
            candidate.status = CandidateStatus.archived
            
        try:
            await db.commit()
            print("Commit successful!")
        except Exception as e:
            print(f"Commit failed with exception: {str(e)}")
            import traceback
            traceback.print_exc()

if __name__ == "__main__":
    import sys
    offer_id = int(sys.argv[1]) if len(sys.argv) > 1 else 1
    asyncio.run(test_revoke(offer_id))
