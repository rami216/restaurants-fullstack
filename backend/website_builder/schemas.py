# website_builder/schemas.py

from pydantic import BaseModel, ConfigDict, Field,StringConstraints
from typing import Optional, List, Dict, Any,Annotated
from uuid import UUID
# import datetime
# from datetime import datetime as d  # <-- this gives you the class, not the module
from datetime import datetime

def to_camel(s: str) -> str:
    parts = s.split("_")
    return parts[0] + "".join(p.title() for p in parts[1:])

# --- Core Flexible Property Schemas ---

class Visibility(BaseModel):
    requiresAuth: Optional[bool] = None
    requiresAnonymous: Optional[bool] = None
    roles: Optional[List[str]] = None


class EditableProp(BaseModel):
    key: str
    label: str
    type: str

class AiElementPayload(BaseModel):
    aiTemplate: str
    properties: Dict[str, Any]
    editableProps: List[Dict[str, Any]]
    script: Optional[str] = None
    
# class ElementProperties(BaseModel):
#     class Config:
#         extra = "allow"

# --- Element Schemas ---
class ElementBase(BaseModel):
    element_type: str
    position: int
    properties: Dict[str, Any]
class ElementCreate(ElementBase):
    subsection_id: UUID
    # THE FIX: Add aiPayload field, aliased from snake_case
    ai_payload: Optional[AiElementPayload] = Field(None, alias="aiPayload")

class ElementUpdate(BaseModel):
    position: Optional[int] = None
    properties: Optional[Dict[str, Any]] = None # Use simple Dict
    element_type: Optional[str] = None
    ai_payload: Optional[AiElementPayload] = Field(None, alias="aiPayload")


class ElementResponse(ElementBase):
    element_id: UUID
    # THE FIX: Add aiPayload field for responses
    ai_payload: Optional[AiElementPayload] = Field(None, alias="aiPayload")

    class Config:
        from_attributes = True
        populate_by_name = True # Allow aliasing


# --- Subsection Schemas ---
class SubsectionBase(BaseModel):
    position: int
    properties: Dict[str, Any] # e.g., {"flexDirection": "row", "justifyContent": "center"}

class SubsectionCreate(SubsectionBase):
    section_id: UUID

class SubsectionUpdate(BaseModel):
    position: Optional[int] = None
    properties: Optional[Dict[str, Any]] = None

class SubsectionResponse(SubsectionBase):
    subsection_id: UUID
    elements: List[ElementResponse] = []
    class Config:
        from_attributes = True

class SectionBase(BaseModel):
    section_type: str
    position: int
    # ADD THIS: The properties field is now part of the base model
    properties: Dict[str, Any] = {}

class SectionCreate(SectionBase):
    page_id: UUID

class SectionUpdate(BaseModel):
    position: Optional[int] = None
    # ADD THIS: Allow properties to be updated
    properties: Optional[Dict[str, Any]] = None

class SectionResponse(SectionBase):
    section_id: UUID
    subsections: List[SubsectionResponse] = []
    class Config:
        from_attributes = True

# --- Page Schemas ---
class PageBase(BaseModel):
    title: str
    slug: str
    properties: Optional[Dict[str, Any]] = None  

class PageCreate(PageBase):
    website_id: UUID

class PageUpdate(BaseModel):
    title: Optional[str] = None
    slug: Optional[str] = None
    properties: Optional[Dict[str, Any]] = None

class PageResponse(PageBase):
    page_id: UUID
    class Config:
        from_attributes = True

class FullPageResponse(PageResponse):
    sections: List[SectionResponse] = []

# --- Navbar Schemas ---
class NavbarItemBase(BaseModel):
    text: str
    link_url: str
    position: int

class NavbarItemCreate(NavbarItemBase):
    navbar_id: UUID

class NavbarItemUpdate(BaseModel):
    text: Optional[str] = None
    link_url: Optional[str] = None
    position: Optional[int] = None

class NavbarItemResponse(NavbarItemBase):
    item_id: UUID
    class Config:
        from_attributes = True

# ADDED THIS SCHEMA FOR UPDATES
class NavbarUpdate(BaseModel):
    properties: Optional[Dict[str, Any]] = None

class NavbarResponse(BaseModel):
    navbar_id: UUID
    properties: Dict[str, Any] = {} # <-- ADDED THIS
    items: List[NavbarItemResponse] = []
    class Config:
        from_attributes = True

# --- Website Schemas ---
class WebsiteBase(BaseModel):
    subdomain: Annotated[
        str,
        Field(pattern=r'^[a-z0-9-]+$'), # Validation rules go in Field
        StringConstraints(strip_whitespace=True, to_lower=True) # Conversion rules go here
    ]

class WebsiteCreate(WebsiteBase):
    pass

class WebsiteResponse(WebsiteBase):
    website_id: UUID
    restaurant_id: UUID
    pages: List[FullPageResponse] = []
    navbar: Optional[NavbarResponse] = None

    ai_spend_limit_usd: float | None = None
    total_spend_usd: float = 0
    monthly_spend_usd: float = 0
    
    primary_custom_domain: Optional[str] = None
    primary_custom_domain_status: Optional[str] = None # <-- New: More descriptive than a boolean
    primary_custom_domain_id: Optional[UUID] = None   # <-- add this
    
    payment_method: str
    class Config:
        from_attributes = True

class WebsiteUpdatePayload(BaseModel):
    payment_method: str
    
class LocationResponse(BaseModel):
    location_id: UUID
    location_name: str

    class Config:
        from_attributes = True
     
class PublicWebsiteResponse(WebsiteResponse):
    locations: List[LocationResponse] = []

    class Config(WebsiteResponse.Config):
        pass
    
    
#region form
class FormSubmissionBase(BaseModel):
    website_id: UUID
    form_element_id: UUID
    submission_data: Dict[str, Any]

class FormSubmissionCreate(FormSubmissionBase):
    pass

class FormSubmissionResponse(FormSubmissionBase):
    submission_id: UUID
    created_at: datetime

    class Config:
        from_attributes = True


#endregion form

#region customdomain
class CustomDomainCreate(BaseModel):
    website_id: UUID
    domain: str

class CustomDomainOut(BaseModel):
    id: UUID
    website_id: UUID
    domain: str
    status: str
    last_error: str | None = None
    created_at: datetime
    verified_at: datetime | None = None

    class Config:
        from_attributes = True

#endregion customdomain


class WebsiteOrderResponse(BaseModel):
    order_id: UUID
    customer_name: str
    customer_email: str
    customer_phone: Optional[str]
    shipping_address: str
    cart_items: List[Dict[str, Any]]
    total_amount_cents: int
    currency: str
    status: str
    created_at: datetime