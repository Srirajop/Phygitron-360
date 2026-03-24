from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.responses import JSONResponse
from pydantic import BaseModel, EmailStr
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.database import get_db
from app.models.user import User
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

    clear_failed_login(ip)
    token_data = {"sub": str(user.id), "role": user.role.value, "org_id": user.org_id}
    access_token = create_access_token(token_data)
    refresh_token = create_refresh_token(token_data)

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
        }
    }, "Login successful")


@router.post("/refresh")
async def refresh_token(body: RefreshRequest):
    payload = decode_token(body.refresh_token)
    if payload.get("type") != "refresh":
        raise HTTPException(status_code=401, detail="Invalid refresh token")
    user_id = payload.get("sub")
    new_access = create_access_token({"sub": user_id, "role": payload.get("role"), "org_id": payload.get("org_id")})
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
async def get_me(current_user: User = Depends(get_current_user)):
    return success({
        "id": current_user.id,
        "email": current_user.email,
        "full_name": current_user.full_name,
        "role": current_user.role.value,
        "org_id": current_user.org_id,
        "first_login": current_user.first_login,
    })
