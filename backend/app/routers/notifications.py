from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, func
from app.database import get_db
from app.models.user import User
from app.models.notification import Notification, NotificationType
from app.utils.auth import get_current_user

router = APIRouter(prefix="/api/v1/notifications", tags=["Notifications"])

def success(data=None, message=""):
    return {"success": True, "data": data or {}, "message": message}

@router.get("")
async def list_notifications(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    query = select(Notification).where(Notification.user_id == current_user.id).order_by(Notification.created_at.desc())
    result = await db.execute(query)
    return success([{
        "id": n.id,
        "title": n.title,
        "message": n.message,
        "type": n.notification_type.value,
        "is_read": n.is_read,
        "link": n.link,
        "created_at": n.created_at.isoformat()
    } for n in result.scalars()])

@router.get("/unread-count")
async def get_unread_count(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    query = select(func.count()).select_from(Notification).where(
        Notification.user_id == current_user.id,
        Notification.is_read == False
    )
    result = await db.execute(query)
    return success(result.scalar() or 0)

@router.post("/{notification_id}/read")
async def mark_as_read(
    notification_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    await db.execute(
        update(Notification).where(Notification.id == notification_id, Notification.user_id == current_user.id).values(is_read=True)
    )
    await db.commit()
    return success(message="Notification marked as read")

@router.post("/read-all")
async def mark_all_read(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    await db.execute(
        update(Notification).where(Notification.user_id == current_user.id).values(is_read=True)
    )
    await db.commit()
    return success(message="All notifications marked as read")

async def create_notification(
    db: AsyncSession,
    user_id: int,
    title: str,
    message: str,
    ntype: NotificationType = NotificationType.info,
    link: Optional[str] = None
):
    notif = Notification(
        user_id=user_id,
        title=title,
        message=message,
        notification_type=ntype,
        link=link
    )
    db.add(notif)
    await db.commit()
    return notif
