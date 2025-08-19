# website_builder/public_router.py
from fastapi import APIRouter, Depends, Request, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from database import get_db
from .models import Website, CustomDomain

router = APIRouter(prefix="/public", tags=["Public"])

@router.get("/resolve")
async def resolve_by_host(
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    host = request.headers.get("host","").split(":")[0].lower()

    # 1) custom domain?
    # The status check is updated from "verified" to "active" for Cloudflare.
    cd = (await db.execute(
        select(CustomDomain).where(CustomDomain.domain==host, CustomDomain.status=="active")
    )).scalars().first()
    
    if cd:
        website = (await db.execute(select(Website).where(Website.website_id==cd.website_id))).scalars().first()
        if not website:
            raise HTTPException(404, "Website not found for this domain.")
        return {"website_id": str(website.website_id), "subdomain": website.subdomain}

    raise HTTPException(404, "No site mapped to this host.")