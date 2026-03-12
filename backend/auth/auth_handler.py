# auth/auth_handler.py

from datetime import datetime, timedelta
from jose import JWTError, jwt
from passlib.context import CryptContext

from fastapi import Depends, HTTPException, status, Request
from fastapi.security import OAuth2PasswordBearer

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from config import SECRET_KEY, ALGORITHM, ACCESS_TOKEN_EXPIRE_MINUTES
from database import get_db
from models import User
from agents.zygo_models import ZygoUser  # ✅ ADD THIS IMPORT
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)


async def get_user(db: AsyncSession, email: str) -> User | None:
    result = await db.execute(
        select(User).where(User.email == email)
    )
    return result.scalars().first()


async def authenticate_user(db: AsyncSession, email: str, password: str):
    user = await get_user(db, email)
    if not user or not verify_password(password, user.hashed_password):
        return None
    return user


def create_access_token(subject: str) -> str:
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode = {"exp": expire, "sub": subject}
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


# async def get_current_user(
#     request: Request,
#     db: AsyncSession = Depends(get_db)
# ):
#     token = request.cookies.get("access_token")
#     if not token:
#         raise HTTPException(status_code=401, detail="Not authenticated")

#     try:
#         payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
#         email: str = payload.get("sub")
#         if not email:
#             raise HTTPException(status_code=401, detail="Invalid token")
#     except JWTError:
#         raise HTTPException(status_code=401, detail="Invalid token")

#     user = await get_user(db, email)
#     if not user:
#         raise HTTPException(status_code=401, detail="User not found")
    
#     return user

async def get_current_user(
    request: Request,
    db: AsyncSession = Depends(get_db)
):
    # ── 1. Check for Desktop Agent Token (Authorization Header) ──
    auth_header = request.headers.get("Authorization")
    
    if auth_header and auth_header.startswith("Bearer "):
        zygo_token = auth_header.replace("Bearer ", "").strip()
        
        # Look up the Zygo Agent by its token
        zygo_result = await db.execute(select(ZygoUser).where(ZygoUser.api_token == zygo_token))
        zygo_user = zygo_result.scalars().first()
        
        if zygo_user:
            # Token is valid! Find the actual User account it belongs to
            user_result = await db.execute(select(User).where(User.id == zygo_user.user_id))
            real_user = user_result.scalars().first()
            if real_user:
                return real_user
            
        # If they sent a Bearer token but it's invalid, reject them immediately
        raise HTTPException(status_code=401, detail="Invalid Agent Token")

    # ── 2. Fallback to Standard Web Login (Browser Cookie) ──
    token = request.cookies.get("access_token")
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")

    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email: str = payload.get("sub")
        if not email:
            raise HTTPException(status_code=401, detail="Invalid token")
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")

    user = await get_user(db, email)
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    
    return user


async def get_current_active_user(current_user=Depends(get_current_user)):
    # Optional: check current_user.is_active
    return current_user
