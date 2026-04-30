import secrets
import string
from datetime import datetime, timedelta, timezone
from typing import Optional, List
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import JWTError, jwt
from passlib.context import CryptContext
import redis
from app.config import settings

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
security = HTTPBearer()

# Redis client with fallback for local dev without redis
class InMemoryRedis:
    def __init__(self):
        self._data = {}
    def get(self, key): return self._data.get(key)
    def setex(self, key, time, value): self._data[key] = value
    def delete(self, key): self._data.pop(key, None)
    def pipeline(self): return self
    def incr(self, key): 
        val = int(self._data.get(key, 0)) + 1
        self._data[key] = str(val)
        return val
    def expire(self, key, time): pass
    def execute(self): pass

try:
    redis_client = redis.from_url(settings.REDIS_URL, decode_responses=True)
    redis_client.ping() # Check connection
except Exception:
    print("Warning: Redis not found. Using in-memory fallback for development.")
    redis_client = InMemoryRedis()


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)


def generate_temp_password(length: int = 12) -> str:
    alphabet = string.ascii_letters + string.digits + "!@#$%"
    password = (
        secrets.choice(string.ascii_uppercase)
        + secrets.choice(string.digits)
        + secrets.choice("!@#$%")
        + "".join(secrets.choice(alphabet) for _ in range(length - 3))
    )
    return "".join(secrets.SystemRandom().sample(password, len(password)))


def create_access_token(data: dict) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire, "type": "access"})
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm="HS256")


def create_refresh_token(data: dict) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    to_encode.update({"exp": expire, "type": "refresh"})
    token = jwt.encode(to_encode, settings.SECRET_KEY, algorithm="HS256")
    # Store in Redis
    redis_client.setex(
        f"refresh_token:{data['sub']}",
        timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS),
        token
    )
    return token


def decode_token(token: str) -> dict:
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=["HS256"])
        return payload
    except JWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token")


def invalidate_refresh_token(user_id: int):
    redis_client.delete(f"refresh_token:{user_id}")


def check_rate_limit(ip: str) -> bool:
    """Returns True if rate limit exceeded (5 failed attempts in 15 min)."""
    key = f"failed_login:{ip}"
    count = redis_client.get(key)
    if count and int(count) >= 5:
        return True
    return False


def increment_failed_login(ip: str):
    key = f"failed_login:{ip}"
    pipe = redis_client.pipeline()
    pipe.incr(key)
    pipe.expire(key, 900)  # 15 minutes
    pipe.execute()


def clear_failed_login(ip: str):
    redis_client.delete(f"failed_login:{ip}")


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    from app.database import AsyncSessionLocal
    from app.models.user import User
    from sqlalchemy import select

    token = credentials.credentials
    payload = decode_token(token)

    if payload.get("type") != "access":
        raise HTTPException(status_code=401, detail="Invalid token type")

    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid token payload")

    async with AsyncSessionLocal() as db:
        result = await db.execute(select(User).where(User.id == int(user_id)))
        user = result.scalar_one_or_none()
        if not user or not user.is_active:
            raise HTTPException(status_code=401, detail="User not found or inactive")
        return user


def require_role(roles: List[str]):
    async def role_checker(current_user=Depends(get_current_user)):
        # Super admin bypasses all role checks
        if current_user.role.value == "super_admin":
            return current_user
        if current_user.role.value not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied. Required roles: {', '.join(roles)}"
            )
        return current_user
    return role_checker


def get_role_level(role_value: str) -> int:
    """Return hierarchy level: 1=Super Admin, 2=Org Admin/Instructor, 3=HR/Manager, 4=User."""
    if role_value == "super_admin":
        return 1
    if role_value in ("org_admin", "instructor"):
        return 2
    if role_value in ("hr", "manager"):
        return 3
    return 4


def require_module(module_name: str):
    """Dependency that checks if the user's org has the given module enabled."""
    async def module_checker(current_user=Depends(get_current_user)):
        # Super admin bypasses module checks
        if current_user.role.value == "super_admin":
            return True

        if not current_user.org_id:
            raise HTTPException(status_code=403, detail="No organisation assigned")

        from app.database import AsyncSessionLocal
        from app.models.organisation import Organisation
        from sqlalchemy import select

        async with AsyncSessionLocal() as db:
            result = await db.execute(select(Organisation).where(Organisation.id == current_user.org_id))
            org = result.scalar_one_or_none()

        if not org or not org.is_active:
            raise HTTPException(status_code=403, detail="Organisation is suspended or not found")

        module_map = {
            "source": org.has_source,
            "verify": org.has_verify,
            "forge": org.has_forge,
            "deploy": org.has_deploy,
        }

        if not module_map.get(module_name, False):
            raise HTTPException(
                status_code=403,
                detail=f"Your organisation does not have access to the '{module_name}' module. Contact your platform administrator."
            )
        return True
    return module_checker
