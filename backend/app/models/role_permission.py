from sqlalchemy import Column, Integer, JSON, ForeignKey, Enum, UniqueConstraint
from app.database import Base
from app.models.user import UserRole


class RolePermission(Base):
    __tablename__ = "role_permissions"

    id = Column(Integer, primary_key=True, index=True)
    org_id = Column(Integer, ForeignKey("organisations.id"), nullable=False)
    role = Column(Enum(UserRole), nullable=False)
    allowed_modules = Column(JSON, nullable=False, default=list)

    __table_args__ = (
        UniqueConstraint('org_id', 'role', name='uq_org_role'),
    )
