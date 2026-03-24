from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from pydantic import BaseModel, EmailStr
from app.database import get_db
from app.models.user import User, UserRole
from app.models.organisation import Organisation
from app.models.skill_taxonomy import SkillTaxonomy
from app.utils.auth import get_current_user, require_role, hash_password

router = APIRouter(prefix="/api/v1/admin", tags=["Admin"])


def success(data=None, message=""):
    return {"success": True, "data": data or {}, "message": message}


@router.get("/users")
async def list_users(
    role: Optional[str] = None,
    current_user: User = Depends(require_role(["admin"])),
    db: AsyncSession = Depends(get_db),
):
    query = select(User).where(User.org_id == current_user.org_id)
    if role:
        query = query.where(User.role == role)
    result = await db.execute(query)
    users = result.scalars().all()
    return success([{
        "id": u.id, "email": u.email, "full_name": u.full_name,
        "role": u.role.value, "is_active": u.is_active,
        "created_at": u.created_at.isoformat() if u.created_at else None,
    } for u in users])


class UserCreate(BaseModel):
    email: EmailStr
    full_name: str
    role: str
    password: str


@router.post("/users")
async def create_user(
    body: UserCreate,
    current_user: User = Depends(require_role(["admin"])),
    db: AsyncSession = Depends(get_db),
):
    existing = await db.execute(select(User).where(User.email == body.email))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Email already registered")

    user = User(
        email=body.email,
        full_name=body.full_name,
        role=body.role,
        password_hash=hash_password(body.password),
        org_id=current_user.org_id,
        is_active=True,
        first_login=True,
    )
    db.add(user)
    await db.commit()
    return success({"id": user.id})


@router.put("/users/{user_id}/role")
async def update_user_role(
    user_id: int,
    role: str,
    current_user: User = Depends(require_role(["admin"])),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.role = role
    await db.commit()
    return success(message="Role updated")


@router.put("/users/{user_id}/toggle-active")
async def toggle_user_active(
    user_id: int,
    current_user: User = Depends(require_role(["admin"])),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.is_active = not user.is_active
    await db.commit()
    return success({"is_active": user.is_active})


@router.get("/org-settings")
async def get_org_settings(
    current_user: User = Depends(require_role(["admin"])),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Organisation).where(Organisation.id == current_user.org_id))
    org = result.scalar_one_or_none()
    if not org:
        raise HTTPException(status_code=404, detail="Organisation not found")
    return success({"id": org.id, "name": org.name, "domain": org.domain, "logo_url": org.logo_url, "primary_color": org.primary_color})


class OrgSettingsUpdate(BaseModel):
    name: Optional[str] = None
    domain: Optional[str] = None
    primary_color: Optional[str] = None


@router.put("/org-settings")
async def update_org_settings(
    body: OrgSettingsUpdate,
    current_user: User = Depends(require_role(["admin"])),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Organisation).where(Organisation.id == current_user.org_id))
    org = result.scalar_one_or_none()
    if body.name:
        org.name = body.name
    if body.domain:
        org.domain = body.domain
    if body.primary_color:
        org.primary_color = body.primary_color
    await db.commit()
    return success(message="Settings updated")


@router.get("/skills")
async def list_skills(
    q: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    query = select(SkillTaxonomy)
    if q:
        query = query.where(SkillTaxonomy.name.ilike(f"%{q}%"))
    query = query.limit(50)
    result = await db.execute(query)
    skills = result.scalars().all()
    return success([{"id": s.id, "name": s.name, "normalized_name": s.normalized_name, "category": s.category} for s in skills])
