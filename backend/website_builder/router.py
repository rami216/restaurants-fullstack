# website_builder/router.py
from fastapi import APIRouter, Depends, HTTPException, status,Response
from uuid import UUID
from sqlalchemy import desc
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from sqlalchemy.orm.attributes import flag_modified
from typing import List
import httpx # <--- ADD THIS
from database import get_db
from auth.auth_handler import get_current_active_user
from models import User, RestaurantOwner,Location,CustomDataSchema
from .models import Website, Page, Section, Subsection, Element, Navbar, NavbarItem,FormSubmission,CustomDomain,WebsiteEmailConfig

from . import schemas
from config import AI_SPEND_LIMIT_USD  # import the default from .env
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import openai
from pydantic import BaseModel
from typing import Optional
import io
from pypdf import PdfReader
from .site_commerce_models import SiteMemberUsage
from .site_auth_models import SiteMember
import os
router = APIRouter(prefix="/builder", tags=["Website Builder v2"])

def _normalize_slug(s: str | None) -> str:
    s = (s or "").strip()
    if not s or s == "/":
        return "/"
    return s if s.startswith("/") else f"/{s}"

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
@router.get("/website", response_model=schemas.WebsiteResponse, response_model_by_alias=True)
async def get_my_website(current_user: User = Depends(get_current_active_user),
                         db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Website)
        .options(
            selectinload(Website.pages).selectinload(Page.sections).selectinload(Section.subsections).selectinload(Subsection.elements),
            selectinload(Website.navbar).selectinload(Navbar.items),
            selectinload(Website.custom_domains)  # <-- ensure relationship exists
        )
        .join(RestaurantOwner)
        .where(RestaurantOwner.user_id == current_user.id)
    )
    website = result.scalars().first()
    if not website:
        raise HTTPException(404, "No website found for this user.")

    # pick the primary domain (or the first if you prefer)
    cd = (await db.execute(
        select(CustomDomain)
        .where(CustomDomain.website_id == website.website_id)
        .order_by(desc(CustomDomain.created_at))
        .limit(1)
    )).scalars().first()

    resp = schemas.WebsiteResponse.model_validate(website)
    if cd:
        resp.primary_custom_domain = cd.domain
        # Note: Cloudflare's success status is "active"
        resp.primary_custom_domain_status = cd.status # <-- New
        resp.primary_custom_domain_id = cd.id
    return resp

# --- THIS IS THE CORRECTED ENDPOINT ---
@router.post("/website", response_model=schemas.WebsiteResponse, status_code=status.HTTP_201_CREATED)
async def create_website(website_data: schemas.WebsiteCreate, current_user: User = Depends(get_current_active_user), db: AsyncSession = Depends(get_db)):
    owner = await db.scalar(select(RestaurantOwner).where(RestaurantOwner.user_id == current_user.id))
    if not owner:
        raise HTTPException(status_code=404, detail="Restaurant owner profile not found.")

    existing_website = await db.scalar(select(Website).where(Website.restaurant_id == owner.restaurant_id))
    if existing_website:
        raise HTTPException(status_code=400, detail="A website already exists for this user.")

    # ✅ ADD THIS BLOCK: Check if the subdomain is already taken by ANY user
    subdomain_check = await db.scalar(
        select(Website).where(Website.subdomain == website_data.subdomain)
    )
    if subdomain_check:
        raise HTTPException(status_code=400, detail="This subdomain is already taken. Please choose another.")
    new_website = Website(
        restaurant_id=owner.restaurant_id,
        subdomain=website_data.subdomain,
        ai_spend_limit_usd=AI_SPEND_LIMIT_USD,  # ← comes from .env (e.g., 8)
    )

    new_navbar = Navbar(website=new_website)
    home_page = Page(website=new_website, title="Home", slug="/")
    section = Section(page=home_page, section_type="hero", position=1, properties={})
    subsection = Subsection(section=section, position=1, properties={"flexDirection": "column", "alignItems": "center"})
    home_nav_item = NavbarItem(navbar=new_navbar, text="Home", link_url="/", position=1)

    db.add_all([new_website, new_navbar, home_page, section, subsection, home_nav_item])
    await db.commit()

    return await get_my_website(current_user, db)

#region paymentmethod
@router.put("/websites/{website_id}/payment-method")
async def update_website_payment_method(
    website_id: UUID,
    payload: schemas.WebsiteUpdatePayload,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    website = await get_website_and_check_ownership(website_id, current_user, db)
    
    if payload.payment_method not in ['stripe', 'cod', 'display']:
        raise HTTPException(status_code=400, detail="Invalid payment method.")
        
    website.payment_method = payload.payment_method
    await db.commit()
    return {"status": "success", "payment_method": website.payment_method}

@router.get("/websites/{website_id}", response_model=schemas.WebsiteSettingsResponse)
async def get_website_details(
    website_id: UUID, 
    db: AsyncSession = Depends(get_db), 
    current_user: User = Depends(get_current_active_user)
):
    """
    Fetch ONLY website settings (lighter and faster).
    """
    # Now this simple query works perfectly because the schema 
    # isn't asking for 'pages' or 'navbar' anymore!
    website = await get_website_and_check_ownership(website_id, current_user, db)
    return website
#endregion paymentmethod
# --- Page Endpoints ---
@router.post("/pages", response_model=schemas.PageResponse, status_code=status.HTTP_201_CREATED)
async def create_page(page_data: schemas.PageCreate, db: AsyncSession = Depends(get_db),
                      current_user: User = Depends(get_current_active_user)):
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

    slug = _normalize_slug(page_data.slug)
    if slug == "/":
        raise HTTPException(status_code=400, detail="Use the existing Home page for '/'.")

    new_page = Page(title=page_data.title, slug=slug,
                    website_id=page_data.website_id,
                    properties=page_data.properties or {})
    db.add(new_page)

    new_item = NavbarItem(
        navbar_id=website.navbar.navbar_id,
        text=new_page.title,
        link_url=new_page.slug,
        position=len(website.navbar.items) + 1
    )
    db.add(new_item)

    await db.commit()
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
@router.post("/elements", response_model=schemas.ElementResponse, status_code=201)
async def create_element(element_data: schemas.ElementCreate, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    # The model_dump now correctly processes the aliased 'aiPayload'
    new_element = Element(**element_data.model_dump(by_alias=False))
    db.add(new_element)
    await db.commit()
    # await db.refresh(new_element)
    return new_element

@router.put("/elements/{element_id}", response_model=schemas.ElementResponse)
async def update_element(
    element_id: UUID, 
    element_data: schemas.ElementUpdate, 
    db: AsyncSession = Depends(get_db), 
    current_user: User = Depends(get_current_active_user)
):
    db_element = await db.get(Element, element_id)
    if not db_element:
        raise HTTPException(status_code=404, detail="Element not found")

    # Get the new data from the request
    update_data = element_data.model_dump(exclude_unset=True)
    
    # Loop through and update the database object
    for key, value in update_data.items():
        setattr(db_element, key, value)
        
        # THIS IS THE CRITICAL FIX:
        # We must flag JSON fields to ensure SQLAlchemy detects the change.
        if key in ["properties", "ai_payload"]:
            flag_modified(db_element, key)

    await db.commit()
    await db.refresh(db_element)
    
    return db_element



@router.delete("/elements/{element_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_element(element_id: UUID, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    db_element = await db.get(Element, element_id)
    if db_element:
        await db.delete(db_element)
        await db.commit()
    return

@router.delete("/schemas/by-element/{element_id}", status_code=204)
async def delete_schema_by_element(
    element_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Finds a schema linked to an element and deletes it.
    This is used when a data-driven element is deleted from the builder.
    """
    element = await db.get(Element, element_id)
    if not element:
        return Response(status_code=204)

    # Note: Add an ownership check here in a real-world app.

    schema_id_to_delete = None
    if element.properties and "schema_id" in element.properties:
        try:
            schema_id_to_delete = UUID(element.properties["schema_id"])
        except (ValueError, TypeError):
            return Response(status_code=204)

    if schema_id_to_delete:
        schema = await db.get(CustomDataSchema, schema_id_to_delete)
        if schema:
            await db.delete(schema)
            await db.commit()
    
    return Response(status_code=204)

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
#region deletepage
async def _delete_page_impl(page_id: UUID, db: AsyncSession, current_user: User):
    # Ownership check
    result = await db.execute(
        select(Page)
        .join(Website)
        .join(RestaurantOwner)
        .where(Page.page_id == page_id, RestaurantOwner.user_id == current_user.id)
    )
    db_page = result.scalars().first()
    if not db_page:
        raise HTTPException(status_code=404, detail="Page not found or no permission")

    if db_page.slug == "/":
        raise HTTPException(status_code=400, detail="Home page cannot be deleted.")

    # Remove nav items pointing at this page (standalone pages will just have none)
    items_q = await db.execute(
        select(NavbarItem)
        .join(Navbar)
        .where(
            Navbar.website_id == db_page.website_id,
            NavbarItem.link_url == db_page.slug
        )
    )
    for item in items_q.scalars().all():
        await db.delete(item)

    await db.delete(db_page)
    await db.commit()

@router.delete("/pages/{page_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_page(page_id: UUID,
                      db: AsyncSession = Depends(get_db),
                      current_user: User = Depends(get_current_active_user)):
    await _delete_page_impl(page_id, db, current_user)
    return Response(status_code=status.HTTP_204_NO_CONTENT)

# ✅ Alias for hosts that block DELETE (or older deployments)
@router.post("/pages/{page_id}/delete", status_code=status.HTTP_204_NO_CONTENT)
async def delete_page_via_post(page_id: UUID,
                               db: AsyncSession = Depends(get_db),
                               current_user: User = Depends(get_current_active_user)):
    await _delete_page_impl(page_id, db, current_user)
    return Response(status_code=status.HTTP_204_NO_CONTENT)

#endregion deletepage
@router.put("/navbar-items/{item_id}", response_model=schemas.NavbarItemResponse)
async def update_navbar_item(item_id: UUID, item_data: schemas.NavbarItemUpdate,
                             db: AsyncSession = Depends(get_db),
                             current_user: User = Depends(get_current_active_user)):
    db_item = await db.get(NavbarItem, item_id)
    if not db_item:
        raise HTTPException(status_code=404, detail="Navbar item not found")

    # Get the original slug to check if it's the homepage
    old_link_url = db_item.link_url
    is_home = (old_link_url == "/")

    update_payload = item_data.model_dump(exclude_unset=True)

    # ✅ Find the associated page using its relationship to the navbar, not the old slug
    page_to_update = None
    if old_link_url:
        # This query is more robust
        result = await db.execute(
            select(Page)
            .join(NavbarItem, Page.slug == NavbarItem.link_url)
            .where(NavbarItem.item_id == item_id)
        )
        page_to_update = result.scalars().first()

    # Apply updates to the NavbarItem text and position
    if "text" in update_payload:
        db_item.text = update_payload["text"]
    if "position" in update_payload:
        db_item.position = update_payload["position"]
    
    # Apply slug (link_url) update, but never for the homepage
    if "link_url" in update_payload and not is_home:
        new_slug = _normalize_slug(update_payload["link_url"])
        db_item.link_url = new_slug
        if page_to_update:
            page_to_update.slug = new_slug

    # Update the page's title to match the navbar item's text
    if page_to_update and "text" in update_payload:
        page_to_update.title = update_payload["text"]

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


# --- ADD THIS FIRST: The by-host route ---
@router.get("/public/by-host", response_model=schemas.PublicWebsiteResponse)
async def resolve_by_host(
    host: str,
    db: AsyncSession = Depends(get_db),
):
    """Finds a website by its custom domain host."""
    # We query CustomDomain exactly like you had in public_router.py
    cd = (await db.execute(
        select(CustomDomain).where(CustomDomain.domain == host, CustomDomain.status == "active")
    )).scalars().first()
    
    if not cd:
        raise HTTPException(status_code=404, detail="Custom domain not found or not active")

    website = await db.get(Website, cd.website_id)
    if not website:
        raise HTTPException(status_code=404, detail="Website not found for this domain")
        
    # Call the subdomain function below to fetch all the page data
    return await get_public_website_by_subdomain(website.subdomain, db)

# --- MUST BE BELOW `by-host`: The catch-all subdomain route ---
@router.get("/public/{subdomain}", response_model=schemas.PublicWebsiteResponse)
async def get_public_website_by_subdomain(
    subdomain: str,
    db: AsyncSession = Depends(get_db),
):
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

#region standalon_page
@router.post("/pages/standalone", response_model=schemas.PageResponse, status_code=status.HTTP_201_CREATED)
async def create_page_standalone(
    page_data: schemas.PageCreate, 
    db: AsyncSession = Depends(get_db), 
    current_user: User = Depends(get_current_active_user)
):
    """Creates a new page without adding it to the navbar."""
    # Check for website ownership
    website = await db.scalar(
        select(Website)
        .join(RestaurantOwner)
        .where(Website.website_id == page_data.website_id, RestaurantOwner.user_id == current_user.id)
    )
    if not website:
        raise HTTPException(status_code=404, detail="Website not found or you do not have permission.")

    # Create and save the new page
    new_page = Page(
        title=page_data.title,
        slug=page_data.slug,
        website_id=page_data.website_id,
        properties=page_data.properties or {}
    )
    db.add(new_page)
    await db.commit()
    await db.refresh(new_page)
    
    return new_page



#region formsubmission

@router.post("/form-submissions", response_model=schemas.FormSubmissionResponse, status_code=status.HTTP_201_CREATED)
async def create_form_submission(
    payload: schemas.FormSubmissionCreate,
    db: AsyncSession = Depends(get_db)
):
    # 1. Save to DB (Standard)
    website = await db.get(Website, payload.website_id)
    if not website: raise HTTPException(404, "Website not found")
    
    new_submission = FormSubmission(**payload.model_dump())
    db.add(new_submission)
    await db.commit()
    await db.refresh(new_submission)

    # 2. Send Smart Email
    try:
        email_config = await db.scalar(select(WebsiteEmailConfig).where(WebsiteEmailConfig.website_id == payload.website_id))
        
        if email_config:
            # --- SMART DATA DETECTION ---
            visitor_email = None
            visitor_name = "there" # Default greeting if no name found
            
            # Loop through the submitted data to find Name and Email
            for key, value in payload.submission_data.items():
                key_lower = key.lower()
                val_str = str(value)

                # 1. Find Email (look for "email" in key or "@" in value)
                if "email" in key_lower and "@" in val_str:
                    visitor_email = val_str
                
                # 2. Find Name (look for keys like "Name", "Full Name", "First Name")
                if "name" in key_lower:
                    visitor_name = val_str

            # Only send if we found an email address
            if visitor_email:
                subject = f"We have received your information - {email_config.from_name}"
                
                # Personalized HTML Body
                body = f"""
                <div style="font-family: sans-serif; padding: 20px; color: #333;">
                    <h2>Dear {visitor_name},</h2>
                    <p>We have received your information.</p>
                    <p>Thank you for contacting <b>{email_config.from_name}</b>.</p>
                    <br>
                    <div style="background-color: #f9f9f9; padding: 15px; border-radius: 5px;">
                        <small>Ref ID: {new_submission.submission_id}</small>
                    </div>
                </div>
                """
                
                # --- SEND VIA SENDGRID ---
                if email_config.provider_type == "sendgrid" and email_config.sendgrid_api_key:
                    async with httpx.AsyncClient() as client:
                        await client.post(
                            "https://api.sendgrid.com/v3/mail/send",
                            headers={"Authorization": f"Bearer {email_config.sendgrid_api_key}", "Content-Type": "application/json"},
                            json={
                                "personalizations": [{"to": [{"email": visitor_email}]}],
                                "from": {"email": email_config.from_email, "name": email_config.from_name},
                                "subject": subject,
                                "content": [{"type": "text/html", "value": body}]
                            }
                        )
                
                # --- SEND VIA SMTP ---
                elif email_config.provider_type == "smtp":
                    message = MIMEMultipart()
                    message["From"] = f"{email_config.from_name} <{email_config.from_email}>"
                    message["To"] = visitor_email
                    message["Subject"] = subject
                    message.attach(MIMEText(body, "html"))

                    # Standard SMTP Logic...
                    timeout = 10
                    if email_config.smtp_port == 465:
                        server = smtplib.SMTP_SSL(email_config.smtp_host, email_config.smtp_port, timeout=timeout)
                    else:
                        server = smtplib.SMTP(email_config.smtp_host, email_config.smtp_port, timeout=timeout)
                        server.ehlo()
                        if server.has_extn("STARTTLS"):
                            server.starttls()
                            server.ehlo()
                    server.login(email_config.smtp_user, email_config.smtp_password)
                    server.sendmail(email_config.from_email, visitor_email, message.as_string())
                    server.quit()

    except Exception as e:
        print(f"Email failed but submission saved: {e}")

    return new_submission

@router.get("/my-submissions", response_model=List[schemas.FormSubmissionResponse])
async def get_my_form_submissions(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Gets all form submissions for the currently logged-in user's websites.
    """
    # 1. Find the owner and their associated website first
    owner_result = await db.execute(
        select(RestaurantOwner)
        .options(selectinload(RestaurantOwner.website))
        .where(RestaurantOwner.user_id == current_user.id)
    )
    owner = owner_result.scalars().first()

    # 2. If the owner or their website doesn't exist, return an empty list
    if not owner or not owner.website:
        return []

    # 3. Fetch all submissions for that single website, newest first
    submissions_result = await db.execute(
        select(FormSubmission)
        .where(FormSubmission.website_id == owner.website.website_id)
        .order_by(FormSubmission.created_at.desc())
    )
    submissions = submissions_result.scalars().all()
    
    return submissions

#endregion formsubmission


@router.post("/ensure-auth-pages/{website_id}")
async def ensure_auth_pages(
    website_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    # Ownership check (reuse your helper if you like)
    result = await db.execute(
        select(Website)
        .options(selectinload(Website.navbar).selectinload(Navbar.items),
                 selectinload(Website.pages))
        .join(RestaurantOwner)
        .where(Website.website_id == website_id, RestaurantOwner.user_id == current_user.id)
    )
    website = result.scalars().first()
    if not website:
        raise HTTPException(404, "Website not found or no permission")

    # Ensure navbar
    if not website.navbar:
        navbar = Navbar(website_id=website.website_id, properties={})
        db.add(navbar)
        await db.flush()  # get id
        await db.refresh(navbar)
        website.navbar = navbar

    # Helper to upsert a page + nav item
    async def upsert_page_and_nav(title: str, slug: str):
        page = next((p for p in website.pages if p.slug == slug), None)
        if not page:
            page = Page(website_id=website.website_id, title=title, slug=slug)
            db.add(page)
            await db.flush()
        # navbar item
        nav = website.navbar
        has_item = any(i.link_url == slug for i in nav.items)
        if not has_item:
            position = (max([i.position for i in nav.items], default=0) + 1)
            db.add(NavbarItem(navbar_id=nav.navbar_id, text=title, link_url=slug, position=position))

    await upsert_page_and_nav("Login", "/login")
    await upsert_page_and_nav("Register", "/register")
    await db.commit()

    # Return updated navbar + pages
    return {"ok": True}


#region updatepage
@router.put("/pages/{page_id}", response_model=schemas.PageResponse)
async def update_page(
    page_id: UUID,
    payload: schemas.PageUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    result = await db.execute(
        select(Page)
        .join(Website)
        .join(RestaurantOwner)
        .where(Page.page_id == page_id, RestaurantOwner.user_id == current_user.id)
    )
    db_page = result.scalars().first()
    if not db_page:
        raise HTTPException(status_code=404, detail="Page not found or no permission")

    data = payload.model_dump(exclude_unset=True)

    # ⛔ don't allow changing the slug of the homepage
    if "slug" in data:
        new_slug = _normalize_slug(data["slug"])
        if db_page.slug == "/":
            # Ignore attempts to move the homepage
            data.pop("slug", None)
        else:
            data["slug"] = new_slug

    for k, v in data.items():
        setattr(db_page, k, v)
        if k == "properties":
            flag_modified(db_page, "properties")

    await db.commit()
    return db_page



#endregion updatepage
#region emailconfig
@router.get("/websites/{website_id}/email-config", response_model=schemas.EmailConfigResponse)
async def get_email_config(
    website_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    # Check ownership
    await get_website_and_check_ownership(website_id, current_user, db)
    
    config = await db.scalar(select(WebsiteEmailConfig).where(WebsiteEmailConfig.website_id == website_id))
    if not config:
        raise HTTPException(status_code=404, detail="Email configuration not found")
    return config

@router.put("/websites/{website_id}/email-config", response_model=schemas.EmailConfigResponse)
async def update_email_config(
    website_id: UUID,
    payload: schemas.EmailConfigCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    # Check ownership
    await get_website_and_check_ownership(website_id, current_user, db)
    
    config = await db.scalar(select(WebsiteEmailConfig).where(WebsiteEmailConfig.website_id == website_id))
    
    if not config:
        # Create new
        config = WebsiteEmailConfig(website_id=website_id, **payload.model_dump())
        db.add(config)
    else:
        # Update existing
        update_data = payload.model_dump(exclude_unset=True)
        for key, value in update_data.items():
            setattr(config, key, value)
            
    await db.commit()
    await db.refresh(config)
    return config

# Optional: Test Endpoint
@router.post("/websites/{website_id}/email-config/test")
async def test_email_config(
    website_id: UUID,
    payload: schemas.EmailConfigCreate, 
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    # 1. Check ownership
    await get_website_and_check_ownership(website_id, current_user, db)

    to_email = current_user.email
    subject = "Test Email from Your Website Builder"
    body_content = "<h1>It Works!</h1><p>This is a test email.</p>"

    # --- LOGIC FOR SENDGRID (HTTP API) ---
    if payload.provider_type == "sendgrid":
        if not payload.sendgrid_api_key:
            raise HTTPException(status_code=400, detail="SendGrid API Key is missing.")
        
        async with httpx.AsyncClient() as client:
            response = await client.post(
                "https://api.sendgrid.com/v3/mail/send",
                headers={
                    "Authorization": f"Bearer {payload.sendgrid_api_key}",
                    "Content-Type": "application/json"
                },
                json={
                    "personalizations": [{"to": [{"email": to_email}]}],
                    "from": {"email": payload.from_email, "name": payload.from_name},
                    "subject": subject,
                    "content": [{"type": "text/html", "value": body_content}]
                }
            )
            
            if response.status_code not in [200, 201, 202]:
                raise HTTPException(status_code=400, detail=f"SendGrid Error: {response.text}")
                
        return {"status": "success", "message": f"Test email sent via SendGrid to {to_email}"}

    # --- LOGIC FOR SMTP (Gmail/Outlook) ---
    else:
        try:
            message = MIMEMultipart()
            message["From"] = f"{payload.from_name} <{payload.from_email}>"
            message["To"] = to_email
            message["Subject"] = subject
            message.attach(MIMEText(body_content, "html"))

            # Auto-detect SSL vs TLS based on port
            timeout_seconds = 10
            if payload.smtp_port == 465:
                # SSL Connection (Preferred for Gmail on some clouds)
                server = smtplib.SMTP_SSL(payload.smtp_host, payload.smtp_port, timeout=timeout_seconds)
            else:
                # TLS Connection (Standard)
                server = smtplib.SMTP(payload.smtp_host, payload.smtp_port, timeout=timeout_seconds)
                server.ehlo()
                if server.has_extn("STARTTLS"):
                    server.starttls()
                    server.ehlo()

            server.login(payload.smtp_user, payload.smtp_password)
            server.sendmail(payload.from_email, to_email, message.as_string())
            server.quit()

            return {"status": "success", "message": f"Test email sent via SMTP to {to_email}"}

        except Exception as e:
            print(f"Email Error: {e}")
            raise HTTPException(status_code=400, detail=f"Connection failed: {str(e)}")
        
@router.post("/send-email", status_code=status.HTTP_200_OK)
async def send_custom_email(
    payload: schemas.EmailSendRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    Sends a one-off email using the website's configured provider (SendGrid or SMTP).
    """
    # 1. Fetch the configuration for this website
    email_config = await db.scalar(
        select(WebsiteEmailConfig).where(WebsiteEmailConfig.website_id == payload.website_id)
    )

    if not email_config:
        raise HTTPException(status_code=404, detail="Email configuration not found for this website.")

    # 2. Prepare Email Data
    visitor_email = payload.to_email
    subject = payload.subject
    # Wrap content in a basic div to ensure it renders nicely
    body_content = f"<div style='font-family: sans-serif;'>{payload.content}</div>"

    try:
        # --- SEND VIA SENDGRID ---
        if email_config.provider_type == "sendgrid":
            if not email_config.sendgrid_api_key:
                raise HTTPException(status_code=400, detail="SendGrid API Key is missing.")

            async with httpx.AsyncClient() as client:
                response = await client.post(
                    "https://api.sendgrid.com/v3/mail/send",
                    headers={
                        "Authorization": f"Bearer {email_config.sendgrid_api_key}",
                        "Content-Type": "application/json"
                    },
                    json={
                        "personalizations": [{"to": [{"email": visitor_email}]}],
                        "from": {"email": email_config.from_email, "name": email_config.from_name},
                        "subject": subject,
                        "content": [{"type": "text/html", "value": body_content}]
                    }
                )
                if response.status_code not in [200, 201, 202]:
                     print(f"SendGrid Error: {response.text}")
                     raise HTTPException(status_code=400, detail="Failed to send email via SendGrid")

        # --- SEND VIA SMTP ---
        elif email_config.provider_type == "smtp":
            message = MIMEMultipart()
            message["From"] = f"{email_config.from_name} <{email_config.from_email}>"
            message["To"] = visitor_email
            message["Subject"] = subject
            message.attach(MIMEText(body_content, "html"))

            timeout_seconds = 10
            
            # Logic to handle SSL (465) vs TLS (587)
            if email_config.smtp_port == 465:
                server = smtplib.SMTP_SSL(email_config.smtp_host, email_config.smtp_port, timeout=timeout_seconds)
            else:
                server = smtplib.SMTP(email_config.smtp_host, email_config.smtp_port, timeout=timeout_seconds)
                server.ehlo()
                if server.has_extn("STARTTLS"):
                    server.starttls()
                    server.ehlo()

            server.login(email_config.smtp_user, email_config.smtp_password)
            server.sendmail(email_config.from_email, visitor_email, message.as_string())
            server.quit()

        return {"status": "success", "message": "Email sent successfully"}

    except HTTPException as he:
        raise he
    except Exception as e:
        print(f"Email send error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to send email: {str(e)}")
#endregion emailconfig


class OpenAIKeyUpdate(BaseModel):
    openai_api_key: Optional[str] = None
    member_ai_spend_limit_usd: Optional[float] = None # ✅ ADDED DYNAMIC LIMIT

@router.put("/websites/{website_id}/openai-key")
async def update_openai_key(
    website_id: UUID,
    payload: OpenAIKeyUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Safely updates OpenAI key and member spending limits."""
    website = await get_website_and_check_ownership(website_id, current_user, db)
    
    # Only update the key if it was explicitly sent (and isn't the dummy placeholder)
    if payload.openai_api_key is not None and not payload.openai_api_key.startswith("sk-...."):
        # If they sent an empty string, they are deleting the key
        website.openai_api_key = payload.openai_api_key if payload.openai_api_key.strip() else None

    # ✅ Update the spend limit
    if payload.member_ai_spend_limit_usd is not None:
        website.member_ai_spend_limit_usd = payload.member_ai_spend_limit_usd
        
    await db.commit()
    return {"status": "success"}

PRICE_PER_1M_PROMPT = 0.150
PRICE_PER_1M_COMPLETION = 0.600

class OpenAIPayload(BaseModel):
    website_id: UUID
    member_id: Optional[UUID] = None
    prompt: str
    system_prompt: Optional[str] = "You are a helpful AI assistant."
    max_tokens: Optional[int] = 500

@router.post("/openai")
async def call_openai_proxy(payload: OpenAIPayload, db: AsyncSession = Depends(get_db)):
    website = await db.get(Website, payload.website_id)
    if not website:
        raise HTTPException(status_code=404, detail="Website not found.")

    # ==========================================
    # 1. STRICT BYOK: The Website Owner MUST have their own key!
    # ==========================================
    if not website.openai_api_key:
        raise HTTPException(
            status_code=400, 
            detail="The owner of this website has not configured their AI API Key."
        )

    # ==========================================
    # 2. CHECK MICRO LIMIT (The Site Member)
    # ==========================================
    member_usage = None
    if payload.member_id:
        member_usage = await db.scalar(
            select(SiteMemberUsage).where(
                SiteMemberUsage.website_id == payload.website_id,
                SiteMemberUsage.member_id == payload.member_id
            )
        )
        if not member_usage:
            member_usage = SiteMemberUsage(
                website_id=payload.website_id, 
                member_id=payload.member_id, 
                ai_spend_usd=0.0, 
                ai_calls_count=0
            )
            db.add(member_usage)

        # ✅ DYNAMIC LIMIT: Use the Owner's setting from the UI (default to $0.10)
        member_limit = getattr(website, 'member_ai_spend_limit_usd', 0.10)
        if member_limit is None: 
            member_limit = 0.10

        # Enforce the limit the Website Owner set for their users
        if member_usage.ai_spend_usd > member_limit: 
            raise HTTPException(
                status_code=403, 
                detail=f"AI Limit Reached (${member_limit:.2f} max). Please upgrade your plan."
            )

    # ==========================================
    # 3. CALL OPENAI & TRACK SPENDING
    # ==========================================
    try:
        # We use the Website Owner's key, so OpenAI bills THEIR credit card directly!
        client = openai.AsyncOpenAI(api_key=website.openai_api_key)
        
        response = await client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": payload.system_prompt},
                {"role": "user", "content": payload.prompt}
            ],
            max_tokens=payload.max_tokens
        )
        
        # Calculate the cost so the Website Owner can see how much their users are spending
        if response.usage:
            prompt_cost = (response.usage.prompt_tokens / 1_000_000) * PRICE_PER_1M_PROMPT
            comp_cost = (response.usage.completion_tokens / 1_000_000) * PRICE_PER_1M_COMPLETION
            total_cost = prompt_cost + comp_cost
            
            # Update the Website Owner's total analytics ledger
            website.current_ai_spend_usd = getattr(website, 'current_ai_spend_usd', 0.0) + total_cost
            
            # Update the member's tracking wallet
            if member_usage:
                member_usage.ai_spend_usd += total_cost
                member_usage.ai_calls_count += 1
                
            await db.commit()

        return {"text": response.choices[0].message.content}
        
    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"OpenAI Error: {str(e)}")

#region pdfparser
class PDFParseRequest(BaseModel):
    pdf_url: str

@router.post("/parse-pdf")
async def parse_pdf_from_url(payload: PDFParseRequest):
    """Downloads a PDF from a URL, extracts the text, and returns it."""
    try:
        # 1. Download the PDF file from the URL into memory
        async with httpx.AsyncClient() as client:
            response = await client.get(payload.pdf_url)
            response.raise_for_status()
            
        # 2. Load the bytes into a memory buffer
        pdf_file = io.BytesIO(response.content)
        
        # 3. Read the PDF and extract text page by page
        reader = PdfReader(pdf_file)
        extracted_text = ""
        
        for page in reader.pages:
            text = page.extract_text()
            if text:
                extracted_text += text + "\n"
                
        # 4. Return the raw text
        return {"text": extracted_text.strip()}
        
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to parse PDF: {str(e)}") 
#endregion pdfparser
#region ai_usage_analytics
@router.get("/websites/{website_id}/ai-analytics")
async def get_website_ai_analytics(
    website_id: UUID, 
    db: AsyncSession = Depends(get_db), 
    current_user: User = Depends(get_current_active_user)
):
    """Fetches the master AI usage analytics for the Website Owner."""
    # 1. Verify the user actually owns this website
    website = await get_website_and_check_ownership(website_id, current_user, db)

    # 2. Fetch usages AND the actual member details using a JOIN
    # ✅ FIX 1: Changed SiteMember.id to SiteMember.member_id
    result = await db.execute(
        select(SiteMemberUsage, SiteMember)
        .join(SiteMember, SiteMemberUsage.member_id == SiteMember.member_id)
        .where(SiteMemberUsage.website_id == website_id)
        .order_by(SiteMemberUsage.ai_spend_usd.desc())
    )
    
    # .all() returns tuples of (usage_record, member_record)
    rows = result.all()

    # 3. Format the data to include the Email!
    user_data = []
    for usage, member in rows:
        user_data.append({
            "member_id": str(usage.member_id),
            "email": member.email,
            # ✅ FIX 2: Safely pass None for name since your DB doesn't have a name column yet
            "name": None, 
            "ai_spend_usd": float(usage.ai_spend_usd) if usage.ai_spend_usd else 0.0,
            "ai_calls_count": usage.ai_calls_count or 0
        })

    total_spend = sum(u["ai_spend_usd"] for u in user_data)
    total_calls = sum(u["ai_calls_count"] for u in user_data)

    return {
        "total_spend_usd": total_spend,
        "total_calls": total_calls,
        "users": user_data
    }
    
    #region FetchExternalPayload
    
class FetchExternalPayload(BaseModel):
    url: str
    method: Optional[str] = "GET"
    headers: Optional[dict] = None
    json_body: Optional[dict] = None

@router.post("/fetch-external")
async def fetch_external_api(payload: FetchExternalPayload):
    """
    Acts as a proxy to fetch external APIs and bypass browser CORS.
    """
    # ⚠️ SECURITY WARNING (SSRF Protection):
    # In a real production app, you should restrict which URLs can be fetched 
    # to prevent people from scanning your internal AWS/server network (localhost, 169.254.x.x)
    if "localhost" in payload.url or "127.0.0.1" in payload.url:
        raise HTTPException(status_code=403, detail="Internal network requests blocked.")

    try:
        async with httpx.AsyncClient() as client:
            request_kwargs = {
                "method": payload.method.upper(),
                "url": payload.url,
                "headers": payload.headers or {},
            }
            
            if payload.json_body:
                request_kwargs["json"] = payload.json_body

            response = await client.request(**request_kwargs)
            
            # Return JSON if possible, otherwise return plain text
            try:
                data = response.json()
            except ValueError:
                data = response.text

            return {
                "status_code": response.status_code, 
                "data": data,
                "headers": dict(response.headers)
            }
            
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"External API fetch failed: {str(e)}")