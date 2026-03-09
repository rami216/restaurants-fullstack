# database.py
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker, declarative_base

from config import DATABASE_URL

# 1) engine & session factory
engine = create_async_engine(DATABASE_URL, echo=True, future=True)
AsyncSessionLocal = sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False
)

# 2) base class for models
Base = declarative_base()

# 3) dependency for FastAPI routes
async def get_db():
    async with AsyncSessionLocal() as session:
        yield session

# 4) call at startup to create tables
async def init_db():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)



