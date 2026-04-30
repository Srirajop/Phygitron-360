import enum
from datetime import datetime
from sqlalchemy import Column, Integer, String, Boolean, Enum, DateTime, ForeignKey, Text, func
from sqlalchemy.orm import relationship
from app.database import Base


class NotificationType(str, enum.Enum):
    info = "info"
    success = "success"
    warning = "warning"
    error = "error"
    admin_alert = "admin_alert"


class Notification(Base):
    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    title = Column(String(255), nullable=False)
    message = Column(Text, nullable=False)
    notification_type = Column(Enum(NotificationType), default=NotificationType.info)
    is_read = Column(Boolean, default=False)
    link = Column(String(255), nullable=True) # Optional link to a specific page
    created_at = Column(DateTime, server_default=func.now(), nullable=False)

    user = relationship("User")
