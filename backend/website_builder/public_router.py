# website_builder/public_router.py
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload

from database import get_db
from .models import Website, CustomDomain, Page, Section, Subsection, Element, Navbar, NavbarItem, Location
from . import schemas

router = APIRouter(prefix="/public", tags=["Public"])

# This is the function your /by-host endpoint needs to call
async def get_public_website_by_subdomain(subdomain: str, db: AsyncSession):
    result = await db.execute(
        select(Website)
        .options(
            selectinload(Website.pages)
                .selectinload(Page.sections)
                .selectinload(Section.subsections)
                .selectinload(Subsection.elements),
            selectinload(Website.navbar)
                .selectinload(Navbar.items),
        )
        .where(Website.subdomain == subdomain)
    )
    website: Website = result.scalars().first()
    if not website:
        raise HTTPException(status_code=404, detail="Website not found.")

    loc_q = await db.execute(
        select(Location).where(Location.restaurant_id == website.restaurant_id)
    )
    location_list = loc_q.scalars().all()

    return schemas.PublicWebsiteResponse(
        **website.__dict__,
        locations=location_list
    )

@router.get("/by-host", response_model=schemas.PublicWebsiteResponse)
async def resolve_by_host(
    host: str,
    db: AsyncSession = Depends(get_db),
):
    """Finds a website by its custom domain host."""
    cd = (await db.execute(
        select(CustomDomain).where(CustomDomain.domain == host, CustomDomain.status == "active")
    )).scalars().first()
    
    if not cd:
        raise HTTPException(404, "Custom domain not found or not active")

    website = await db.get(Website, cd.website_id)
    if not website:
        raise HTTPException(404, "Website not found for this domain")
        
    # Now, call the other function to get the full public data
    return await get_public_website_by_subdomain(website.subdomain, db)