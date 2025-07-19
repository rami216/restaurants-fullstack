# website_builder/schemas.py

from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from uuid import UUID
import datetime

# --- Element Schemas ---
class ElementBase(BaseModel):
    element_type: str
    position: int
    properties: Dict[str, Any]

class ElementCreate(ElementBase):
    subsection_id: UUID

class ElementUpdate(BaseModel):
    position: Optional[int] = None
    properties: Optional[Dict[str, Any]] = None

class ElementResponse(ElementBase):
    element_id: UUID
    class Config:
        from_attributes = True

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

class PageCreate(PageBase):
    website_id: UUID

class PageUpdate(BaseModel):
    title: Optional[str] = None
    slug: Optional[str] = None

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
    subdomain: Optional[str] = None

class WebsiteCreate(WebsiteBase):
    pass

class WebsiteResponse(WebsiteBase):
    website_id: UUID
    restaurant_id: UUID
    pages: List[FullPageResponse] = [] # Correctly uses the full page response
    navbar: Optional[NavbarResponse] = None
    class Config:
        from_attributes = True
