# website_builder/schemas.py

from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from uuid import UUID
import datetime

def to_camel(s: str) -> str:
    parts = s.split("_")
    return parts[0] + "".join(p.title() for p in parts[1:])


class EditableProp(BaseModel):
    key: str
    label: str
    type: str  # "text" | "number" | "color"


class AiElementPayload(BaseModel):
    aiTemplate:     str                   = Field(..., alias="aiTemplate")
    properties:     Dict[str, Any]
    editableProps:  List[EditableProp]    = Field(..., alias="editableProps")

    class Config:
        allow_population_by_field_name = True
        orm_mode = True
        extra = "ignore"    # <-- ignore any unexpected keys inside aiPayload
        
# --- Element Schemas ---
class ElementBase(BaseModel):
    element_type: str
    position: int
    properties: Dict[str, Any]
    ai_payload: Optional[AiElementPayload] = None

    class Config:
        allow_population_by_field_name = True
        alias_generator = to_camel
        orm_mode = True
        
class ElementCreate(BaseModel):
    subsection_id: UUID
    element_type:  str
    position:      int
    properties:    Dict[str, Any]
    # ai_payload:    Optional[AiElementPayload] = Field(None, alias="aiPayload")
    ai_payload: Optional[AiElementPayload] = None

    class Config:
        allow_population_by_field_name = True
        orm_mode = True
        extra = "ignore"    # <-- ignore any unexpected keys at top level



class ElementUpdate(BaseModel):
    position:   Optional[int]           = None
    properties: Optional[Dict[str, Any]] = None
    ai_payload: Optional[AiElementPayload] = None


class ElementResponse(BaseModel):
    # elementId:   UUID                  = Field(..., alias="element_id")
    # elementType: str                   = Field(..., alias="element_type")
    # position:    int
    # properties:  Dict[str, Any]
    # aiPayload:    Optional[AiElementPayload] = Field(None, alias="ai_payload")
    # element_id:   UUID
    # element_type: str
    # position:     int
    # properties:   Dict[str, Any]
    # aiPayload:    Optional[AiElementPayload] = Field(None, alias="ai_payload")
    element_id:   UUID
    element_type: str
    position:     int
    properties:   Dict[str, Any]
    # ← camelCase on the left, snake_case alias on the right
    aiPayload:    Optional[AiElementPayload] = Field(None, alias="ai_payload")

    class Config:
        orm_mode = True
        allow_population_by_field_name = True
        allow_population_by_alias = True


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

class LocationResponse(BaseModel):
    location_id: UUID
    location_name: str

    class Config:
        from_attributes = True
        
class PublicWebsiteResponse(WebsiteResponse):
    locations: List[LocationResponse] = []

    class Config(WebsiteResponse.Config):
        pass