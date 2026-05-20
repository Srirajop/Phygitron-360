import re
with open('d:/Downloads/Phygitron360/backend/app/routers/source.py', 'r', encoding='utf-8') as f:
    content = f.read()

target = '''@router.post("/job-roles")
async def create_job_role(
    body: JobRoleCreate,
    current_user: User = Depends(require_role(["hr", "org_admin"])),
    db: AsyncSession = Depends(get_db),
):
    role = JobRole(
        org_id=current_user.org_id,
        title=body.title,
        description=body.description,
        required_skills=body.required_skills or [],
        min_experience=body.min_experience,
    )
    db.add(role)
    await db.commit()
    return success({"id": role.id, "title": role.title, "required_skills": normalise_required_skills(role)})'''

replacement = '''@router.post("/job-roles")
async def create_job_role(
    body: JobRoleCreate,
    current_user: User = Depends(require_role(["hr", "org_admin"])),
    db: AsyncSession = Depends(get_db),
):
    required_skills = body.required_skills or []
    if not required_skills and body.description:
        try:
            from app.agents.agents import run_extract_jd_skills_agent
            import asyncio
            ai_result = await asyncio.to_thread(run_extract_jd_skills_agent, body.description)
            required_skills = [{"skill": s.get("name"), "level": s.get("level", "intermediate")} for s in ai_result.get("skills", [])]
        except Exception as e:
            import logging
            logger = logging.getLogger(__name__)
            logger.warning(f"Failed to extract skills from JD: {e}")

    role = JobRole(
        org_id=current_user.org_id,
        title=body.title,
        description=body.description,
        required_skills=required_skills,
        min_experience=body.min_experience,
    )
    db.add(role)
    await db.commit()
    return success({"id": role.id, "title": role.title, "required_skills": normalise_required_skills(role)})'''

content_crlf = content.replace('\r\n', '\n')
target_crlf = target.replace('\r\n', '\n')
if target_crlf in content_crlf:
    content_crlf = content_crlf.replace(target_crlf, replacement)
    with open('d:/Downloads/Phygitron360/backend/app/routers/source.py', 'w', encoding='utf-8') as f:
        f.write(content_crlf)
    print('Replaced successfully')
else:
    print('Target not found')
