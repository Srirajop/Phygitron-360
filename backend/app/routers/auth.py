from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.responses import JSONResponse
from pydantic import BaseModel, EmailStr
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.database import get_db
from app.models.user import User
from app.models.organisation import Organisation
from app.utils.auth import (
    verify_password, create_access_token, create_refresh_token,
    decode_token, invalidate_refresh_token, get_current_user,
    check_rate_limit, increment_failed_login, clear_failed_login
)

router = APIRouter(prefix="/api/v1/auth", tags=["Auth"])


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class ChangePasswordRequest(BaseModel):
    new_password: str


class RefreshRequest(BaseModel):
    refresh_token: str


def success(data=None, message=""):
    return {"success": True, "data": data if data is not None else {}, "message": message}


def error(msg: str, code: int = 400):
    return JSONResponse(status_code=code, content={"success": False, "error": msg, "code": code})


@router.post("/login")
async def login(request: Request, body: LoginRequest, db: AsyncSession = Depends(get_db)):
    ip = request.client.host if request.client else "unknown"

    if check_rate_limit(ip):
        raise HTTPException(status_code=429, detail="Too many failed attempts. Try again in 15 minutes.")

    result = await db.execute(select(User).where(User.email == body.email))
    user = result.scalar_one_or_none()

    if not user or not verify_password(body.password, user.password_hash):
        increment_failed_login(ip)
        raise HTTPException(status_code=401, detail="Invalid email or password")

    if not user.is_active:
        raise HTTPException(status_code=401, detail="Account is disabled")

    if user.role.value in ["candidate", "trainee"]:
        from app.models.source import Candidate, OfferLetter, OfferStatus, CandidateInvite, InviteStatus
        from datetime import datetime
        cand_res = await db.execute(select(Candidate).where(Candidate.user_id == user.id))
        candidate = cand_res.scalar_one_or_none()
        if candidate:
            offer_res = await db.execute(
                select(OfferLetter).where(OfferLetter.candidate_id == candidate.id).order_by(OfferLetter.created_at.desc())
            )
            offer = offer_res.scalars().first()
            if offer:
                if offer.deadline and offer.deadline < datetime.utcnow() and offer.status in [OfferStatus.pending, OfferStatus.sent, OfferStatus.changes_requested]:
                    offer.status = OfferStatus.revoked
                    await db.commit()
                if offer.status == OfferStatus.revoked:
                    increment_failed_login(ip)
                    raise HTTPException(status_code=403, detail="Your offer has been revoked or expired.")
            else:
                invite_res = await db.execute(
                    select(CandidateInvite).where(CandidateInvite.candidate_id == candidate.id).order_by(CandidateInvite.created_at.desc())
                )
                invite = invite_res.scalars().first()
                if invite:
                    if invite.deadline and invite.deadline < datetime.utcnow() and invite.status in [InviteStatus.sent, InviteStatus.opened, InviteStatus.logged_in]:
                        invite.status = InviteStatus.expired
                        await db.commit()
                    if invite.status == InviteStatus.expired:
                        increment_failed_login(ip)
                        raise HTTPException(status_code=403, detail="Your assessment invitation has expired.")
                    if invite.status == InviteStatus.sent:
                        invite.status = InviteStatus.logged_in
                        invite.logged_in_at = datetime.utcnow()
                        await db.commit()

    clear_failed_login(ip)

    from app.utils.auth import get_role_level
    role_level = get_role_level(user.role.value)

    token_data = {"sub": str(user.id), "role": user.role.value, "org_id": user.org_id, "role_level": role_level}
    access_token = create_access_token(token_data)
    refresh_token = create_refresh_token(token_data)

    # Get org modules for the response
    modules = []
    org_modules = []
    org_name = ""
    if user.org_id:
        org_res = await db.execute(select(Organisation).where(Organisation.id == user.org_id))
        org = org_res.scalar_one_or_none()
        if org:
            org_name = org.name
            if org.has_source: org_modules.append("source")
            if org.has_verify: org_modules.append("verify")
            if org.has_forge: org_modules.append("forge")
            if org.has_deploy: org_modules.append("deploy")
            
    modules = org_modules.copy()
    if role_level == 1:
        modules = ["source", "verify", "forge", "deploy", "platform"]
    elif role_level > 2 and user.org_id:
        from app.models.role_permission import RolePermission
        rp_res = await db.execute(select(RolePermission).where(
            RolePermission.org_id == user.org_id,
            RolePermission.role == user.role
        ))
        rp = rp_res.scalar_one_or_none()
        if rp:
            modules = [m for m in org_modules if m in rp.allowed_modules]

    return success({
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
        "role": user.role.value,
        "first_login": user.first_login,
        "user": {
            "id": user.id,
            "email": user.email,
            "full_name": user.full_name,
            "role": user.role.value,
            "org_id": user.org_id,
            "org_name": org_name,
            "role_level": role_level,
            "modules": modules,
        }
    }, "Login successful")


@router.post("/refresh")
async def refresh_token(body: RefreshRequest, db: AsyncSession = Depends(get_db)):
    payload = decode_token(body.refresh_token)
    if payload.get("type") != "refresh":
        raise HTTPException(status_code=401, detail="Invalid refresh token")
    user_id = payload.get("sub")
    # Always fetch current role from DB — not from stale token
    result = await db.execute(select(User).where(User.id == int(user_id)))
    user = result.scalar_one_or_none()
    if not user or not user.is_active:
        raise HTTPException(status_code=401, detail="User not found or inactive")
    from app.utils.auth import get_role_level
    role_level = get_role_level(user.role.value)
    new_access = create_access_token({"sub": str(user.id), "role": user.role.value, "org_id": user.org_id, "role_level": role_level})
    return success({"access_token": new_access}, "Token refreshed")


@router.post("/logout")
async def logout(current_user: User = Depends(get_current_user)):
    invalidate_refresh_token(current_user.id)
    return success(message="Logged out successfully")


@router.post("/change-password")
async def change_password(
    body: ChangePasswordRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    from app.utils.auth import hash_password
    import re
    pwd = body.new_password
    if len(pwd) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters")
    if not re.search(r'\d', pwd):
        raise HTTPException(status_code=400, detail="Password must contain at least one number")
    if not re.search(r'[!@#$%^&*(),.?":{}|<>]', pwd):
        raise HTTPException(status_code=400, detail="Password must contain at least one special character")

    result = await db.execute(select(User).where(User.id == current_user.id))
    user = result.scalar_one_or_none()
    user.password_hash = hash_password(pwd)
    user.first_login = False
    await db.commit()
    return success(message="Password changed successfully")


@router.get("/me")
async def get_me(current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    from app.utils.auth import get_role_level
    role_level = get_role_level(current_user.role.value)

    modules = []
    org_modules = []
    org_name = ""
    if current_user.org_id:
        org_res = await db.execute(select(Organisation).where(Organisation.id == current_user.org_id))
        org = org_res.scalar_one_or_none()
        if org:
            org_name = org.name
            if org.has_source: org_modules.append("source")
            if org.has_verify: org_modules.append("verify")
            if org.has_forge: org_modules.append("forge")
            if org.has_deploy: org_modules.append("deploy")
            
    modules = org_modules.copy()
    if role_level == 1:
        modules = ["source", "verify", "forge", "deploy", "platform"]
    elif role_level > 2 and current_user.org_id:
        from app.models.role_permission import RolePermission
        rp_res = await db.execute(select(RolePermission).where(
            RolePermission.org_id == current_user.org_id,
            RolePermission.role == current_user.role
        ))
        rp = rp_res.scalar_one_or_none()
        if rp:
            modules = [m for m in org_modules if m in rp.allowed_modules]

    return success({
        "id": current_user.id,
        "email": current_user.email,
        "full_name": current_user.full_name,
        "role": current_user.role.value,
        "org_id": current_user.org_id,
        "org_name": org_name,
        "first_login": current_user.first_login,
        "role_level": role_level,
        "modules": modules,
    })
