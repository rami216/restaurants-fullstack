# website_builder/models.py

from sqlalchemy import Column, String, Integer, DateTime, ForeignKey, JSON
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func, text
from sqlalchemy.orm import relationship
from database import Base

# This is a placeholder for the relationship you would add to your main models.py
# You would add `website = relationship("Website", back_populates="owner", uselist=False)`
# to your existing RestaurantOwner class.

class Website(Base):
    __tablename__ = "websites"

    website_id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    restaurant_id = Column(UUID(as_uuid=True), ForeignKey("restaurant_owners.restaurant_id"), nullable=False, unique=True)
    subdomain = Column(String, unique=True, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    # owner = relationship("RestaurantOwner", back_populates="website") # This link is defined on the RestaurantOwner model
    pages = relationship("Page", back_populates="website", cascade="all, delete-orphan")
    navbar = relationship("Navbar", back_populates="website", uselist=False, cascade="all, delete-orphan")
    restaurant = relationship("RestaurantOwner", back_populates="website")

class Page(Base):
    __tablename__ = "pages"

    page_id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    website_id = Column(UUID(as_uuid=True), ForeignKey("websites.website_id"), nullable=False)
    title = Column(String, nullable=False)
    slug = Column(String, nullable=False)

    # Relationships
    website = relationship("Website", back_populates="pages")
    sections = relationship("Section", back_populates="page", cascade="all, delete-orphan", order_by="Section.position")


class Section(Base):
    __tablename__ = "sections"
    section_id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    page_id = Column(UUID(as_uuid=True), ForeignKey("pages.page_id"), nullable=False)
    section_type = Column(String, nullable=False)
    position = Column(Integer, nullable=False)
    # THE FIX: The properties column was missing. It has been added here.
    properties = Column(JSON, nullable=False, default={})
    page = relationship("Page", back_populates="sections")
    subsections = relationship("Subsection", back_populates="section", cascade="all, delete-orphan", order_by="Subsection.position")


# NEW: Subsection Model
class Subsection(Base):
    __tablename__ = "subsections"

    subsection_id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    section_id = Column(UUID(as_uuid=True), ForeignKey("sections.section_id"), nullable=False)
    position = Column(Integer, nullable=False)
    properties = Column(JSON, nullable=False)  # For layout styles like flex direction

    # Relationships
    section = relationship("Section", back_populates="subsections")
    elements = relationship("Element", back_populates="subsection", cascade="all, delete-orphan", order_by="Element.position")


# UPDATED: Element Model now links to a Subsection
class Element(Base):
    __tablename__ = "elements"

    element_id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    subsection_id = Column(UUID(as_uuid=True), ForeignKey("subsections.subsection_id"), nullable=False)
    element_type = Column(String, nullable=False)
    position = Column(Integer, nullable=False)
    properties = Column(JSON, nullable=False)
    ai_payload     = Column(JSON, nullable=True) 
    # Relationships
    subsection = relationship("Subsection", back_populates="elements")


class Navbar(Base):
    __tablename__ = "navbars"

    navbar_id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    website_id = Column(UUID(as_uuid=True), ForeignKey("websites.website_id"), nullable=False, unique=True)
    properties = Column(JSON, nullable=False, server_default=text("'{}'::jsonb")) # <-- ADDED THIS LINE

    # Relationships
    website = relationship("Website", back_populates="navbar")
    items = relationship("NavbarItem", back_populates="navbar", cascade="all, delete-orphan", order_by="NavbarItem.position")


class NavbarItem(Base):
    __tablename__ = "navbar_items"

    item_id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    navbar_id = Column(UUID(as_uuid=True), ForeignKey("navbars.navbar_id"), nullable=False)
    text = Column(String, nullable=False)
    link_url = Column(String, nullable=False)
    position = Column(Integer, nullable=False)

    # Relationships
    navbar = relationship("Navbar", back_populates="items")
