# website_builder/custom_domains_router.py
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import delete
from uuid import UUID
import os
import re
import httpx
import json

from .models import CustomDomain, Website
from . import schemas
from database import get_db
from auth.auth_handler import get_current_active_user

# --- Cloudflare Credentials from Environment Variables ---
CLOUDFLARE_API_TOKEN = os.getenv("CLOUDFLARE_API_TOKEN")
CLOUDFLARE_ZONE_ID = os.getenv("CLOUDFLARE_ZONE_ID")

# --- Router Setup ---
router = APIRouter(prefix="/custom-domains", tags=["Custom Domains"])

# --- Helper Function ---
_domain_re = re.compile(r"^([a-z0-9-]+\.)*[a-z0-9-]+\.[a-z]{2,}$")

def _clean_domain(s: str) -> str:
    s = s.strip().lower().replace("https://", "").replace("http://", "").strip("/")
    return s

# --- API Endpoints ---
@router.post("")
async def create_custom_domain(
    body: schemas.CustomDomainCreate,
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_active_user),
):
    domain_name = _clean_domain(body.domain)
    if not _domain_re.match(domain_name):
        raise HTTPException(status_code=400, detail="Invalid domain format")
        
    existing = await db.scalar(select(CustomDomain).where(CustomDomain.domain == domain_name))
    
    # --- NEW LOGIC ---
    if existing and existing.last_error:
        # If domain exists, just return the instructions we already have.
        try:
            cf_data = json.loads(existing.last_error)
            verification_details = cf_data.get("ownership_verification", {})
            if verification_details:
                 return {
                    "message": "This domain already exists. Please add the following DNS record.",
                    "record_type": verification_details.get("type"),
                    "record_name": verification_details.get("name"),
                    "record_value": verification_details.get("value"),
                }
        except:
             # If parsing fails, fall through to the create logic
             pass
    elif existing:
        raise HTTPException(status_code=400, detail="Domain already exists but has no Cloudflare data.")

    # --- Original Logic to Create New Domain ---
    headers = {"Authorization": f"Bearer {CLOUDFLARE_API_TOKEN}"}
    payload = {"hostname": domain_name, "ssl": {"method": "http", "type": "dv"}}
    
    async with httpx.AsyncClient() as client:
        r = await client.post(
            f"https://api.cloudflare.com/client/v4/zones/{CLOUDFLARE_ZONE_ID}/custom_hostnames",
            headers=headers,
            json=payload,
        )
        if r.status_code >= 400:
            raise HTTPException(status_code=400, detail=f"Cloudflare API error: {r.text}")
        cf_data = r.json().get("result", {})

    new_domain = CustomDomain(
        website_id=body.website_id,
        domain=domain_name,
        status=cf_data.get("status"),
        last_error=json.dumps(cf_data),
    )
    db.add(new_domain)
    await db.commit()

    verification_details = cf_data.get("ownership_verification", {})
    return {
        "message": "Domain is pending verification. Please add the following DNS record.",
        "record_type": verification_details.get("type"),
        "record_name": verification_details.get("name"),
        "record_value": verification_details.get("value"),
    }


@router.get("", response_model=list[schemas.CustomDomainOut])
async def list_custom_domains(
    website_id: UUID = Query(...),
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_active_user),
):
    """Lists all custom domains for a given website from your database."""
    rows = (await db.execute(select(CustomDomain).where(CustomDomain.website_id == website_id))).scalars().all()
    return rows

@router.post("/{custom_domain_id}/refresh", response_model=schemas.CustomDomainOut)
async def refresh_custom_domain_status(
    custom_domain_id: UUID,
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_active_user),
):
    """Checks the latest status of a domain with Cloudflare."""
    cd = await db.get(CustomDomain, custom_domain_id)
    if not cd:
        raise HTTPException(status_code=404, detail="Custom domain not found.")

    if not cd.last_error:
        raise HTTPException(status_code=400, detail="No Cloudflare data found for this domain.")

    try:
        cf_data = json.loads(cd.last_error)
        cf_hostname_id = cf_data.get("id")
        if not cf_hostname_id:
            raise HTTPException(status_code=400, detail="Cloudflare Hostname ID missing.")
    except (json.JSONDecodeError, AttributeError):
        raise HTTPException(status_code=400, detail="Could not parse Cloudflare data.")

    headers = {"Authorization": f"Bearer {CLOUDFLARE_API_TOKEN}"}
    async with httpx.AsyncClient() as client:
        r = await client.get(
            f"https://api.cloudflare.com/client/v4/zones/{CLOUDFLARE_ZONE_ID}/custom_hostnames/{cf_hostname_id}",
            headers=headers,
        )
        if r.status_code >= 400:
            return cd
        
        updated_cf_data = r.json().get("result", {})

    cd.status = updated_cf_data.get("status")
    cd.last_error = json.dumps(updated_cf_data)
    await db.commit()
    
    return cd

@router.delete("/{custom_domain_id}", status_code=204)
async def delete_custom_domain(
    custom_domain_id: UUID,
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_active_user),
):
    """Deletes a custom domain from Cloudflare and your database."""
    cd = await db.get(CustomDomain, custom_domain_id)
    if not cd:
        return

    if cd.last_error:
        try:
            cf_data = json.loads(cd.last_error)
            cf_hostname_id = cf_data.get("id")
            
            if cf_hostname_id:
                headers = {"Authorization": f"Bearer {CLOUDFLARE_API_TOKEN}"}
                async with httpx.AsyncClient() as client:
                    await client.delete(
                        f"https://api.cloudflare.com/client/v4/zones/{CLOUDFLARE_ZONE_ID}/custom_hostnames/{cf_hostname_id}",
                        headers=headers,
                    )
        except Exception:
            pass

    await db.delete(cd)
    await db.commit()
    return