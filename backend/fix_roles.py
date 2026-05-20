import asyncio
from app.database import AsyncSessionLocal
from sqlalchemy import select
from app.models.source import JobRole
from app.agents.agents import run_extract_jd_skills_agent
import json

async def fix_job_roles():
    async with AsyncSessionLocal() as session:
        result = await session.execute(select(JobRole))
        roles = result.scalars().all()
        for role in roles:
            if not role.required_skills and role.description:
                print(f"Fixing role {role.id}: {role.title}")
                try:
                    # run extraction synchronously as we're not inside the FastAPI event loop
                    ai_result = run_extract_jd_skills_agent(role.description)
                    new_skills = [{"skill": s.get("name"), "level": s.get("level", "intermediate")} for s in ai_result.get("skills", [])]
                    print(f"Extracted skills: {new_skills}")
                    role.required_skills = new_skills
                except Exception as e:
                    print(f"Failed to extract skills for {role.id}: {e}")
        await session.commit()
        print("Done.")

if __name__ == "__main__":
    asyncio.run(fix_job_roles())
