# website_builder/router.py
from fastapi import APIRouter, Depends, HTTPException, status
from uuid import UUID
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from sqlalchemy.orm.attributes import flag_modified
from typing import List

from database import get_db
from auth.auth_handler import get_current_active_user
from models import User, RestaurantOwner
from .models import Website, Page, Section, Subsection, Element, Navbar, NavbarItem
from . import schemas

router = APIRouter(prefix="/builder", tags=["Website Builder v2"])

# --- Helper function for ownership check ---
async def get_website_and_check_ownership(website_id: UUID, current_user: User, db: AsyncSession) -> Website:
    result = await db.execute(
        select(Website)
        .join(RestaurantOwner)
        .where(Website.website_id == website_id, RestaurantOwner.user_id == current_user.id)
    )
    website = result.scalars().first()
    if not website:
        raise HTTPException(status_code=404, detail="Website not found or you do not have permission.")
    return website

# --- Website Endpoints ---
@router.get("/website", response_model=schemas.WebsiteResponse)
async def get_my_website(current_user: User = Depends(get_current_active_user), db: AsyncSession = Depends(get_db)):
    """Gets the current user's website with all nested data."""
    result = await db.execute(
        select(Website).options(
            selectinload(Website.pages).selectinload(Page.sections).selectinload(Section.subsections).selectinload(Subsection.elements),
            selectinload(Website.navbar).selectinload(Navbar.items)
        ).join(RestaurantOwner).where(RestaurantOwner.user_id == current_user.id)
    )
    website = result.scalars().first()
    if not website:
        raise HTTPException(status_code=404, detail="No website found for this user.")
    return website

# --- THIS IS THE CORRECTED ENDPOINT ---
@router.post("/website", response_model=schemas.WebsiteResponse, status_code=status.HTTP_201_CREATED)
async def create_website(website_data: schemas.WebsiteCreate, current_user: User = Depends(get_current_active_user), db: AsyncSession = Depends(get_db)):
    """Creates a new website with default page, section, subsection, and navbar."""
    owner = await db.scalar(select(RestaurantOwner).where(RestaurantOwner.user_id == current_user.id))
    if not owner: raise HTTPException(status_code=404, detail="Restaurant owner profile not found.")
    
    existing_website = await db.scalar(select(Website).where(Website.restaurant_id == owner.restaurant_id))
    if existing_website: raise HTTPException(status_code=400, detail="A website already exists for this user.")

    # Create all the objects
    new_website = Website(restaurant_id=owner.restaurant_id, subdomain=website_data.subdomain)
    new_navbar = Navbar(website=new_website)
    home_page = Page(website=new_website, title="Home", slug="/")
    section = Section(page=home_page, section_type="hero", position=1, properties={})
    subsection = Subsection(section=section, position=1, properties={"flexDirection": "column", "alignItems": "center"})
    home_nav_item = NavbarItem(navbar=new_navbar, text="Home", link_url="/", position=1)
    
    db.add_all([new_website, new_navbar, home_page, section, subsection, home_nav_item])
    await db.commit()
    
    # THE FIX: After committing, re-fetch the website using the comprehensive query.
    # This ensures the returned object is fully loaded and matches the response model perfectly.
    created_website = await get_my_website(current_user, db)
    
    return created_website

# --- Page Endpoints ---
@router.post("/pages", response_model=schemas.PageResponse, status_code=status.HTTP_201_CREATED)
async def create_page(page_data: schemas.PageCreate, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    website = await get_website_and_check_ownership(page_data.website_id, current_user, db)
    await db.refresh(website, ['navbar']) # Eagerly load navbar to get items
    if not website.navbar: raise HTTPException(status_code=404, detail="Navbar not found.")
    
    new_page = Page(title=page_data.title, slug=page_data.slug, website_id=page_data.website_id)
    db.add(new_page)
    
    new_navbar_item = NavbarItem(navbar_id=website.navbar.navbar_id, text=new_page.title, link_url=new_page.slug, position=len(website.navbar.items) + 1)
    db.add(new_navbar_item)
    
    await db.commit()
    await db.refresh(new_page)
    return new_page

# --- Section Endpoints ---
@router.post("/sections", response_model=schemas.SectionResponse, status_code=status.HTTP_201_CREATED)
async def create_section(section_data: schemas.SectionCreate, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    new_section = Section(**section_data.model_dump())
    db.add(new_section)
    await db.commit()
    await db.refresh(new_section, ["subsections"])
    return new_section

# --- Subsection Endpoint ---
@router.post("/subsections", response_model=schemas.SubsectionResponse, status_code=201)
async def create_subsection(subsection_data: schemas.SubsectionCreate, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    new_subsection = Subsection(**subsection_data.model_dump())
    db.add(new_subsection)
    await db.commit()
    await db.refresh(new_subsection, ["elements"])
    return new_subsection

# --- Element Endpoints ---
@router.post("/elements", response_model=schemas.ElementResponse, status_code=201)
async def create_element(element_data: schemas.ElementCreate, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    new_element = Element(**element_data.model_dump())
    db.add(new_element)
    await db.commit()
    await db.refresh(new_element)
    return new_element

@router.put("/elements/{element_id}", response_model=schemas.ElementResponse)
async def update_element(element_id: UUID, element_data: schemas.ElementUpdate, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    db_element = await db.get(Element, element_id)
    if not db_element: raise HTTPException(status_code=404, detail="Element not found")

    if element_data.properties is not None:
        db_element.properties = element_data.properties
        flag_modified(db_element, "properties")

    if element_data.position is not None:
        db_element.position = element_data.position
    
    await db.commit()
    await db.refresh(db_element)
    return db_element