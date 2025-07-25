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
from models import User, RestaurantOwner,Location
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
@router.get("/website", response_model=schemas.WebsiteResponse,response_model_by_alias=True,)
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
    # THE FIX: Eagerly load the navbar and its items to prevent the async error
    result = await db.execute(
        select(Website)
        .options(selectinload(Website.navbar).selectinload(Navbar.items))
        .join(RestaurantOwner)
        .where(Website.website_id == page_data.website_id, RestaurantOwner.user_id == current_user.id)
    )
    website = result.scalars().first()
    if not website:
        raise HTTPException(status_code=404, detail="Website not found or you do not have permission.")

    if not website.navbar: 
        raise HTTPException(status_code=404, detail="Navbar not found.")
    
    new_page = Page(title=page_data.title, slug=page_data.slug, website_id=page_data.website_id)
    db.add(new_page)
    
    # This line is now safe because website.navbar.items is pre-loaded
    new_navbar_item = NavbarItem(navbar_id=website.navbar.navbar_id, text=new_page.title, link_url=new_page.slug, position=len(website.navbar.items) + 1)
    db.add(new_navbar_item)
    
    await db.commit()
    # await db.refresh(new_page)
    return new_page

# --- Section Endpoints ---
@router.post("/sections", response_model=schemas.SectionResponse, status_code=status.HTTP_201_CREATED)
async def create_section(section_data: schemas.SectionCreate, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    new_section = Section(**section_data.model_dump())
    db.add(new_section)
    await db.commit()
    
    # UPDATED: Re-fetch the created section with its relationships
    result = await db.execute(
        select(Section).options(selectinload(Section.subsections)).where(Section.section_id == new_section.section_id)
    )
    return result.scalars().first()

@router.put("/sections/{section_id}", response_model=schemas.SectionResponse)
async def update_section(section_id: UUID, section_data: schemas.SectionUpdate, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    # THE FIX: Eagerly load the 'subsections' and their 'elements' to prevent the async error
    result = await db.execute(
        select(Section).options(
            selectinload(Section.subsections).selectinload(Subsection.elements)
        ).where(Section.section_id == section_id)
    )
    db_section = result.scalars().first()
    if not db_section: raise HTTPException(status_code=404, detail="Section not found")
    
    update_data = section_data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_section, key, value)
        if key == "properties":
            flag_modified(db_section, "properties")

    await db.commit()
    # await db.refresh(db_section)
    return db_section

@router.delete("/sections/{section_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_section(section_id: UUID, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    db_section = await db.get(Section, section_id)
    if db_section:
        await db.delete(db_section)
        await db.commit()
    return

# --- Subsection Endpoint ---
@router.post("/subsections", response_model=schemas.SubsectionResponse, status_code=201)
async def create_subsection(subsection_data: schemas.SubsectionCreate, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    new_subsection = Subsection(**subsection_data.model_dump())
    db.add(new_subsection)
    await db.commit()
    
    # UPDATED: Re-fetch the created subsection with its relationships to fix the Greenlet error
    result = await db.execute(
        select(Subsection).options(selectinload(Subsection.elements)).where(Subsection.subsection_id == new_subsection.subsection_id)
    )
    return result.scalars().first()

@router.put("/subsections/{subsection_id}", response_model=schemas.SubsectionResponse)
async def update_subsection(subsection_id: UUID, subsection_data: schemas.SubsectionUpdate, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    # THE FIX: Eagerly load the 'elements' relationship
    result = await db.execute(
        select(Subsection).options(selectinload(Subsection.elements)).where(Subsection.subsection_id == subsection_id)
    )
    db_subsection = result.scalars().first()
    if not db_subsection: raise HTTPException(status_code=404, detail="Subsection not found")

    update_data = subsection_data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_subsection, key, value)
        if key == "properties":
            flag_modified(db_subsection, "properties")

    await db.commit()
    # await db.refresh(db_subsection)
    return db_subsection

@router.delete("/subsections/{subsection_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_subsection(subsection_id: UUID, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    db_subsection = await db.get(Subsection, subsection_id)
    if db_subsection:
        await db.delete(db_subsection)
        await db.commit()
    return


# --- Element Endpoints ---
@router.post("/elements", response_model=schemas.ElementResponse, status_code=201,response_model_by_alias=True,)
async def create_element(
    element_data: schemas.ElementCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    vals = element_data.model_dump()   # this now includes ai_payload if you sent it
    el = Element(**vals)
    db.add(el)
    await db.commit()
    await db.refresh(el)
    return el

@router.put("/elements/{element_id}", response_model=schemas.ElementResponse)
async def update_element(
    element_id: UUID,
    data: schemas.ElementUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    el = await db.get(Element, element_id)
    if data.properties is not None:
        el.properties = data.properties
        flag_modified(el, "properties")
    # we do NOT overwrite ai_payload here
    if data.position is not None:
        el.position = data.position
    await db.commit()
    await db.refresh(el)
    return el


@router.delete("/elements/{element_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_element(element_id: UUID, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    db_element = await db.get(Element, element_id)
    if db_element:
        await db.delete(db_element)
        await db.commit()
    return

# --- Navbar Endpoints ---
@router.put("/navbars/{navbar_id}", response_model=schemas.NavbarResponse)
async def update_navbar(navbar_id: UUID, navbar_data: schemas.NavbarUpdate, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    result = await db.execute(
        select(Navbar).options(selectinload(Navbar.items)).where(Navbar.navbar_id == navbar_id)
    )
    db_navbar = result.scalars().first()
    if not db_navbar:
        raise HTTPException(status_code=404, detail="Navbar not found")

    update_data = navbar_data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_navbar, key, value)
        if key == "properties":
            flag_modified(db_navbar, "properties")

    await db.commit()
    # await db.refresh(db_navbar)
    return db_navbar

# --- NEW: Navbar Item Endpoints ---
@router.post("/navbar-items", response_model=schemas.NavbarItemResponse, status_code=status.HTTP_201_CREATED)
async def create_navbar_item(item_data: schemas.NavbarItemCreate, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    # A proper check would ensure the user owns the navbar's parent website
    new_item = NavbarItem(**item_data.model_dump())
    db.add(new_item)
    await db.commit()
    # await db.refresh(new_item)
    return new_item

@router.put("/navbar-items/{item_id}", response_model=schemas.NavbarItemResponse)
async def update_navbar_item(item_id: UUID, item_data: schemas.NavbarItemUpdate, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    """
    Updates a navbar item and also finds and updates the corresponding page.
    """
    db_item = await db.get(NavbarItem, item_id)
    if not db_item:
        raise HTTPException(status_code=404, detail="Navbar item not found")

    # Store the old link_url to find the associated page
    old_link_url = db_item.link_url

    # Update the navbar item with new data from the request
    update_data = item_data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_item, key, value)

    # Find the page that corresponds to the OLD navbar link
    if old_link_url:
        result = await db.execute(select(Page).where(Page.slug == old_link_url))
        page_to_update = result.scalars().first()
        
        # If a page is found, update its title and slug to match the new navbar item
        if page_to_update:
            page_to_update.title = db_item.text
            page_to_update.slug = db_item.link_url

    await db.commit()
    await db.refresh(db_item)
    return db_item

@router.delete("/navbar-items/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_navbar_item(item_id: UUID, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    """
    Deletes a navbar item and also finds and deletes the corresponding page.
    """
    db_item = await db.get(NavbarItem, item_id)
    if not db_item:
        # If it's already deleted, just return success
        return

    # Find the page that corresponds to the navbar link
    if db_item.link_url:
        result = await db.execute(select(Page).where(Page.slug == db_item.link_url))
        page_to_delete = result.scalars().first()
        
        # If a page is found, delete it
        if page_to_delete:
            await db.delete(page_to_delete)

    # Delete the navbar item itself
    await db.delete(db_item)
    await db.commit()
    return


@router.get("/public/{subdomain}", response_model=schemas.PublicWebsiteResponse)
async def get_public_website_by_subdomain(
    subdomain: str,
    db: AsyncSession = Depends(get_db),
):
    # 1) fetch the site + all its pages, sections, subsections, etc.
    result = await db.execute(
        select(Website)
        .options(
            selectinload(Website.pages)
                .selectinload(Page.sections)
                .selectinload(Section.subsections)
                .selectinload(Subsection.elements),
            selectinload(Website.navbar)
                .selectinload(Navbar.items),
            # we’ll fetch locations separately
        )
        .where(Website.subdomain == subdomain)
    )
    website: Website = result.scalars().first()
    if not website:
        raise HTTPException(status_code=404, detail="Website not found.")

    # 2) now fetch all locations for that restaurant
    loc_q = await db.execute(
        select(Location)
        .where(Location.restaurant_id == website.restaurant_id)
    )
    location_list = loc_q.scalars().all()

    # 3) return a PublicWebsiteResponse, pydantic will pick up all fields + our new locations
    return schemas.PublicWebsiteResponse(
        **website.__dict__,      # all the fields from WebsiteResponse
        locations=location_list  # our new list of LocationResponse
    )
