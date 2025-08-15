# config.py
import asyncio
from decouple import config
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine
from decimal import Decimal

# pull in your DATABASE_URL from .env
DATABASE_URL = config("DATABASE_URL")
SECRET_KEY = config("SECRET_KEY")
ALGORITHM = config("ALGORITHM", default="HS256")
ACCESS_TOKEN_EXPIRE_MINUTES = config("ACCESS_TOKEN_EXPIRE_MINUTES", cast=int, default=43200) # 30 days
# create the engine
engine = create_async_engine(DATABASE_URL, echo=True)
# Base app URL for redirects
APP_URL = config("APP_URL", default="http://localhost:3000")

AI_PRICE_INPUT_PER_MTOK  = Decimal(config("AI_PRICE_INPUT_PER_MTOK",  default="2.5"))
AI_PRICE_OUTPUT_PER_MTOK = Decimal(config("AI_PRICE_OUTPUT_PER_MTOK", default="10"))
AI_DEFAULT_MODEL = config("AI_DEFAULT_MODEL", default="gpt-4o")


def get_app_url():
    """Return the frontend app base URL for redirecting Stripe sessions."""
    return APP_URL

async def test():
    # open a connection
    async with engine.connect() as conn:
        # wrap your SQL in sqlalchemy.text()
        result = await conn.execute(text("SELECT 1"))
        print("scalar result:", result.scalar())

if __name__ == "__main__":
    asyncio.run(test())
