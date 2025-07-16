# config.py
import asyncio
from decouple import config
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine

# pull in your DATABASE_URL from .env
DATABASE_URL = config("DATABASE_URL")
SECRET_KEY = config("SECRET_KEY")
ALGORITHM = config("ALGORITHM", default="HS256")
ACCESS_TOKEN_EXPIRE_MINUTES = config("ACCESS_TOKEN_EXPIRE_MINUTES", cast=int, default=30)

# create the engine
engine = create_async_engine(DATABASE_URL, echo=True)

async def test():
    # open a connection
    async with engine.connect() as conn:
        # wrap your SQL in sqlalchemy.text()
        result = await conn.execute(text("SELECT 1"))
        print("scalar result:", result.scalar())

if __name__ == "__main__":
    asyncio.run(test())
