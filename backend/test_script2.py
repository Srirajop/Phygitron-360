import asyncio
import json
import urllib.request
import urllib.parse
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy import text
from datetime import datetime, timedelta
from jose import jwt

SECRET_KEY = "9a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p"
ALGORITHM = "HS256"

def create_access_token(data: dict, expires_delta: timedelta | None = None):
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=15))
    to_encode.update({"exp": expire, "type": "access"})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

async def test():
    engine = create_async_engine('mysql+aiomysql://root:Sriraj12@localhost:3306/phygitron360')
    async_session = sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)
    async with async_session() as session:
        res = await session.execute(text("SELECT id FROM users WHERE role='hr' OR role='org_admin' LIMIT 1"))
        row = res.fetchone()
        if not row:
            print('No user')
            return
        user_id = row[0]
        
    token = create_access_token({"sub": str(user_id)}, timedelta(days=1))
    
    # We must hit 8000 (the main server with reload)
    req3 = urllib.request.Request('http://localhost:8000/api/v1/source/candidates/search?upload_time=2026-06&limit=10')
    req3.add_header('Authorization', f'Bearer {token}')
    try:
        res3 = urllib.request.urlopen(req3)
        print("GET FOLDERS SUCCESS:")
        print(res3.read().decode())
    except Exception as e:
        if hasattr(e, 'read'):
            print('ERROR GET FOLDERS:', e.read().decode())
        else:
            print('ERROR GET FOLDERS:', e)

asyncio.run(test())
