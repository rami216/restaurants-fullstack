# website_builder/public_router.py
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload

from database import get_db
from .models import Website, CustomDomain, Page, Section, Subsection, Element, Navbar, NavbarItem 
from models import Location
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

