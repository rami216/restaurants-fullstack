# website_builder/site_auth_router.py
from fastapi import APIRouter, Depends, HTTPException, Header, Request, Response
from pydantic import BaseModel, EmailStr
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from datetime import datetime, timedelta
from typing import Optional
import bcrypt, jwt, os
import httpx

from database import get_db
from .models import Website
from .site_auth_models import SiteMember
import bcrypt, jwt, os, random, string
import traceback # Add this at the top
router = APIRouter(prefix="/site-auth", tags=["Site Auth"])

# --- JWT config (separate from owner JWT) ---
SITE_JWT_SECRET = os.getenv("SITE_JWT_SECRET", "change-this-site-secret")
SITE_JWT_ALG = "HS256"
SITE_JWT_EXP_MIN = int(os.getenv("SITE_JWT_EXP_MIN", "43200"))  # 30 days


class CodeConfirmationRequest(BaseModel):
    email: EmailStr
    code: str

def create_site_jwt(member_id: str, website_id: str, role: Optional[str] = None):
    now = datetime.utcnow()
    payload = {
        "sub": member_id,
        "website_id": website_id,
        "role": role or "member",
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(minutes=SITE_JWT_EXP_MIN)).timestamp()),
        "typ": "site_jwt",
    }
    return jwt.encode(payload, SITE_JWT_SECRET, algorithm=SITE_JWT_ALG)

def decode_site_jwt(token: str):
    return jwt.decode(token, SITE_JWT_SECRET, algorithms=[SITE_JWT_ALG])

def hash_password(raw: str) -> str:
    return bcrypt.hashpw(raw.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")

def verify_password(raw: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(raw.encode("utf-8"), hashed.encode("utf-8"))
    except Exception:
        return False

# --- Schemas ---
class RegisterDTO(BaseModel):
    email: EmailStr
    password: str

class LoginDTO(BaseModel):
    email: EmailStr
    password: str

class SiteMemberPublic(BaseModel):
    member_id: str
    email: EmailStr
    role: Optional[str] = None

# --- Dependency: resolve website by subdomain ---
async def get_website_by_subdomain(subdomain: str, db: AsyncSession) -> Website:
    site = await db.scalar(select(Website).where(Website.subdomain == subdomain))
    if not site:
        raise HTTPException(status_code=404, detail="Website not found")
    return site

# --- Dependency: site_member_required ---
async def site_member_required(
    subdomain: str,
    db: AsyncSession = Depends(get_db),
    authorization: Optional[str] = Header(None),
):
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Missing bearer token")
    token = authorization.split(" ", 1)[1]
    try:
        payload = decode_site_jwt(token)
    except jwt.ExpiredSignatureError:
        raise HTTPException(401, "Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(401, "Invalid token")

    website = await get_website_by_subdomain(subdomain, db)
    if str(website.website_id) != payload.get("website_id"):
        raise HTTPException(401, "Token-website mismatch")

    member = await db.get(SiteMember, payload.get("sub"))
    if not member or not member.is_active:
        raise HTTPException(401, "Member not active")

    # attach minimal principal
    return {"member": member, "website": website, "claims": payload}

# --- Routes ---
@router.post("/{subdomain}/register")
async def register(subdomain: str, body: RegisterDTO, db: AsyncSession = Depends(get_db)):
    website = await get_website_by_subdomain(subdomain, db)
    exists = await db.scalar(
        select(SiteMember).where(
            SiteMember.website_id == website.website_id,
            SiteMember.email == body.email,
        )
    )
    if exists:
        raise HTTPException(400, "Email already in use on this website")
    code = "".join(random.choices(string.digits, k=6))
    member = SiteMember(
        website_id=website.website_id,
        email=body.email,
        password_hash=hash_password(body.password),
        role="member",
        is_active=False,
        confirmation_code=hash_password(code), # Store a hash of the code
        confirmation_code_expires=datetime.utcnow() + timedelta(minutes=10)
    )
    db.add(member)
    await db.commit()
    
    n8n_webhook_url = "https://n8n.ramiai.xyz/webhook/sitememberverify"
    
    try:
        async with httpx.AsyncClient() as client:
            await client.post(n8n_webhook_url, json={"email": body.email, "code": code})
    except Exception as e:
        # If n8n fails, we don't want to block the user. Log the error for debugging.
        print(f"Failed to send confirmation email webhook for {body.email}: {e}")

    return {"ok": True, "message": "Registration successful. A confirmation code has been sent to your email."}

@router.post("/{subdomain}/login")
async def login(subdomain: str, body: LoginDTO, db: AsyncSession = Depends(get_db)):
    website = await get_website_by_subdomain(subdomain, db)
    member = await db.scalar(
        select(SiteMember).where(
            SiteMember.website_id == website.website_id,
            SiteMember.email == body.email,
        )
    )
    if not member or not verify_password(body.password, member.password_hash):
        raise HTTPException(401, "Invalid credentials")

    # Add check for account confirmation
    if not member.is_active:
        raise HTTPException(401, "Account is not confirmed. Please check your email for a confirmation code.")

    token = create_site_jwt(str(member.member_id), str(website.website_id), member.role)
    return {
        "access_token": token,
        "token_type": "bearer",
        "member_id": str(member.member_id),
        "email": member.email,
        "role": member.role
    }

@router.post("/{subdomain}/confirm-code")
async def confirm_code(subdomain: str, body: CodeConfirmationRequest, db: AsyncSession = Depends(get_db)):
    try: # <--- Start Try Block
        website = await get_website_by_subdomain(subdomain, db)
        member = await db.scalar(
            select(SiteMember).where(
                SiteMember.website_id == website.website_id,
                SiteMember.email == body.email,
            )
        )
        if not member:
            raise HTTPException(404, "User not found.")
        
        if member.is_active:
            raise HTTPException(400, "Account already confirmed.")

        # --- SAFE DATETIME CHECK HERE ---
        expires = member.confirmation_code_expires
        if not expires or expires.replace(tzinfo=None) < datetime.utcnow():
            raise HTTPException(400, "Code has expired.")

        if not member.confirmation_code or not verify_password(body.code, member.confirmation_code):
            raise HTTPException(400, "Invalid confirmation code.")

        member.is_active = True
        member.confirmation_code = None
        member.confirmation_code_expires = None
        await db.commit()

        token = create_site_jwt(str(member.member_id), str(website.website_id), member.role)
        return {
            "access_token": token,
            "token_type": "bearer",
            "member_id": str(member.member_id),
        }

    except HTTPException as h:
        raise h # Let normal HTTP exceptions pass
    except Exception as e:
        # This will print the REAL error to your terminal
        print("!!!!!!!!!!!!! CRITICAL ERROR !!!!!!!!!!!!!")
        traceback.print_exc() 
        raise HTTPException(500, f"Server Error: {str(e)}")
    
@router.get("/{subdomain}/me", response_model=SiteMemberPublic)
async def me(ctx = Depends(site_member_required)):
    m = ctx["member"]
    return SiteMemberPublic(member_id=str(m.member_id), email=m.email, role=m.role)
