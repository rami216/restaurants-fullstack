# auth/router.py
from fastapi import APIRouter, Depends, HTTPException, status, Response
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select   # ← you need this
import random
from database import get_db
from schemas import UserCreate, UserResponse, Token,ConfirmEmailRequest
from models import User
from google.oauth2 import id_token
from google.auth.transport import requests
import os
from pydantic import BaseModel

from auth.auth_handler import (
    authenticate_user,
    get_password_hash,
    create_access_token,
    get_current_active_user,
    ACCESS_TOKEN_EXPIRE_MINUTES,   
)

GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID", "your-google-client-id.apps.googleusercontent.com")


router = APIRouter(prefix="/auth", tags=["auth"])

class GoogleToken(BaseModel):
    credential: str


@router.post("/register", response_model=UserResponse)
async def register(
    user_in: UserCreate,
    db: AsyncSession = Depends(get_db)
):
    # check for existing username
    result = await db.execute(
        select(User).where(User.username == user_in.username)
    )
    if result.scalars().first():
        raise HTTPException(400, "Username already registered")
    code = str(random.randint(100000, 999999))

    user = User(
        username=user_in.username,
        email=user_in.email,
        hashed_password=get_password_hash(user_in.password),
        confirmation_code=code,
        is_active=False
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    
    import httpx
    async with httpx.AsyncClient() as client:
        await client.post(
            "https://n8n.ramiai.xyz/webhook/confirm-email",
            json={
                "email": user_in.email,
                "code": code,
            }
        )
    return user

# --- NEW GOOGLE LOGIN ENDPOINT ---
@router.post("/google-login", response_model=Token)
async def google_login(
    token_data: GoogleToken,
    response: Response,
    db: AsyncSession = Depends(get_db)
):
    """
    Handles the Google Sign-In process.
    """
    print(f"BACKEND IS USING GOOGLE CLIENT ID: {GOOGLE_CLIENT_ID}")
    try:
        # Verify the ID token with Google's servers
        id_info = id_token.verify_oauth2_token(
            token_data.credential, requests.Request(), GOOGLE_CLIENT_ID
        )

        email = id_info.get('email')
        if not email:
            raise HTTPException(status_code=400, detail="Email not found in Google token")

        # Check if user already exists in our database
        result = await db.execute(select(User).where(User.email == email))
        user = result.scalars().first()

        if not user:
            # If user doesn't exist, create a new one
            username = email.split('@')[0] + str(random.randint(100, 999))
            
            # Check if generated username already exists, and regenerate if it does
            while (await db.execute(select(User).where(User.username == username))).scalars().first():
                username = email.split('@')[0] + str(random.randint(100, 999))

            user = User(
                username=username,
                email=email,
                hashed_password=None, # No password for Google users
                is_active=True # Activate immediately
            )
            db.add(user)
            await db.commit()
            await db.refresh(user)

        # Create access token and set cookie, same as regular login
        token = create_access_token(user.email)
        response.set_cookie(
            key="access_token",
            value=token,
            httponly=True,
            secure=False, # Set to True in production
            samesite="lax",
            max_age=60 * ACCESS_TOKEN_EXPIRE_MINUTES,
        )
        return {"access_token": token, "token_type": "bearer"}

    except ValueError:
        # Invalid token
        raise HTTPException(status_code=401, detail="Invalid Google token")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"An error occurred: {e}")



@router.post("/login", response_model=Token)
async def login(
    response: Response,
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: AsyncSession = Depends(get_db)
):
    user = await authenticate_user(db, form_data.username, form_data.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect credentials"
        )
    token = create_access_token(user.email)


    # set JWT in an HttpOnly cookie
    response.set_cookie(
            key="access_token",
            value=token,
            httponly=True,
            secure=False,
            samesite="lax",
            max_age=60 * ACCESS_TOKEN_EXPIRE_MINUTES,
    )

    return {"access_token": token, "token_type": "bearer"}

@router.post("/logout")
async def logout(response: Response):
    response.delete_cookie("access_token")
    return {"msg": "Logged out"}

@router.get("/me", response_model=UserResponse)
async def read_me(current_user=Depends(get_current_active_user)):
    return current_user

@router.post("/confirm")
async def confirm_email(
    payload: ConfirmEmailRequest,
    db: AsyncSession = Depends(get_db)
):
    email = payload.email
    code = payload.code

    result = await db.execute(
        select(User).where(User.email == email)
    )
    user = result.scalars().first()

    if not user:
        raise HTTPException(404, "User not found")

    if user.confirmation_code != code:
        raise HTTPException(400, "Invalid confirmation code")

    user.is_active = True
    user.confirmation_code = None
    await db.commit()

    return {"message": "Email confirmed successfully."}
