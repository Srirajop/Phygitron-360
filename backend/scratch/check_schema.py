import asyncio
import os
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine
from dotenv import load_dotenv

async def main():
    load_dotenv()
    user = os.getenv('DB_USER', 'root')
    password = os.getenv('DB_PASSWORD', '')
    host = os.getenv('DB_HOST', 'localhost')
    db_name = os.getenv('DB_NAME', 'phygitron360')
    db_url = f"mysql+aiomysql://{user}:{password}@{host}/{db_name}"

    engine = create_async_engine(db_url)
    async with engine.connect() as conn:
        res = await conn.execute(text("SHOW TRIGGERS LIKE 'employees'"))
        rows = res.fetchall()
        for r in rows:
            print(r)


    await engine.dispose()

if __name__ == "__main__":
    asyncio.run(main())
