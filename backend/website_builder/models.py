# website_builder/models.py

import uuid
from sqlalchemy import Boolean, Column, String, Integer, DateTime, ForeignKey, JSON,BigInteger, Numeric,Computed, UniqueConstraint
import os

from sqlalchemy.dialects.postgresql import UUID,JSONB
from sqlalchemy.sql import func, text
from sqlalchemy.orm import relationship
from database import Base
# This is a placeholder for the relationship you would add to your main models.py
# You would add `website = relationship("Website", back_populates="owner", uselist=False)`
# to your existing RestaurantOwner class.

DEFAULT_AI_SPEND_LIMIT = os.getenv("AI_SPEND_LIMIT_USD", None)
if DEFAULT_AI_SPEND_LIMIT is not None:
    DEFAULT_AI_SPEND_LIMIT = float(DEFAULT_AI_SPEND_LIMIT)

class Website(Base):
    __tablename__ = "websites"

    website_id  = Column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    restaurant_id = Column(UUID(as_uuid=True), ForeignKey("restaurant_owners.restaurant_id"), nullable=False, unique=True)
    subdomain   = Column(String, unique=True, nullable=True)
    created_at  = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at  = Column(DateTime(timezone=True), onupdate=func.now())

    # AI usage aggregates
    total_prompt_tokens     = Column(BigInteger, nullable=False, server_default=text("0"))
    total_completion_tokens = Column(BigInteger, nullable=False, server_default=text("0"))
    total_spend_usd = Column(Numeric, default=0)
    monthly_spend_usd = Column(Numeric, default=0)
    ai_spend_limit_usd = Column(Numeric, nullable=True, default=DEFAULT_AI_SPEND_LIMIT)
    payment_method = Column(String, default='display', nullable=False)
    monthly_period_start    = Column(DateTime(timezone=True))
    monthly_spend_limit_usd = Column(Numeric(12, 2))  # NULL means no cap

    # Relationships
    pages      = relationship("Page", back_populates="website", cascade="all, delete-orphan")
    navbar     = relationship("Navbar", back_populates="website", uselist=False, cascade="all, delete-orphan")
    restaurant = relationship("RestaurantOwner", back_populates="website")
    ai_usage_logs = relationship("AIUsageLog", back_populates="website", cascade="all, delete-orphan")
    email_config = relationship("WebsiteEmailConfig", uselist=False, back_populates="website", cascade="all, delete-orphan")
    openai_api_key = Column(String, nullable=True)
class AIUsageLog(Base):
    __tablename__ = "ai_usage_logs"

    id         = Column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    website_id = Column(UUID(as_uuid=True), ForeignKey("websites.website_id"), nullable=False, index=True)
    user_id    = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)

    model      = Column(String, nullable=False)
    feature    = Column(String, nullable=False)

    prompt_tokens     = Column(BigInteger, nullable=False, server_default=text("0"))
    completion_tokens = Column(BigInteger, nullable=False, server_default=text("0"))

    input_cost_usd    = Column(Numeric(12, 6), nullable=False, server_default=text("0"))
    output_cost_usd   = Column(Numeric(12, 6), nullable=False, server_default=text("0"))

    # Match the DB "GENERATED ALWAYS AS (... ) STORED"
    total_cost_usd    = Column(
        Numeric(12, 6),
        Computed("input_cost_usd + output_cost_usd", persisted=True),
    )

    meta       = Column(JSONB)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    website    = relationship("Website", back_populates="ai_usage_logs")


class Page(Base):
    __tablename__ = "pages"

    page_id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    website_id = Column(UUID(as_uuid=True), ForeignKey("websites.website_id"), nullable=False)
    title = Column(String, nullable=False)
    slug = Column(String, nullable=False)
    properties = Column(JSON, nullable=False, server_default=text("'{}'::jsonb"))  # <-- add this
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
    ai_payload = Column(JSON, nullable=True)
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

#region forms
class FormSubmission(Base):
    __tablename__ = "form_submissions"

    submission_id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        server_default=text("gen_random_uuid()"),
    )
    # Foreign key to know which website the submission belongs to
    website_id = Column(UUID(as_uuid=True), ForeignKey("websites.website_id"), nullable=False)
    
    # The ID of the specific form element that was submitted
    form_element_id = Column(UUID(as_uuid=True), nullable=False)
    
    # A flexible JSON column to store the actual form data (e.g., {"Name": "John", "Email": "..."})
    submission_data = Column(JSON, nullable=False)

    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationship to the Website model (optional but good practice)
    website = relationship("Website")


#endregion forms

#region customdomains
class CustomDomain(Base):
    __tablename__ = "custom_domains"
    __table_args__ = (UniqueConstraint("domain", name="uq_custom_domain_domain"),)

    id          = Column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    website_id  = Column(UUID(as_uuid=True), ForeignKey("websites.website_id", ondelete="CASCADE"), nullable=False, index=True)
    domain      = Column(String, nullable=False)
    status      = Column(String, nullable=False, server_default=text("'pending'"))
    # render_id column has been removed.
    last_error  = Column(String, nullable=True) # This will store the Cloudflare JSON data
    created_at  = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    verified_at = Column(DateTime(timezone=True), nullable=True)

    website     = relationship("Website", backref="custom_domains")

#endregion customdomains
#region websiteemail
#region websiteemail
class WebsiteEmailConfig(Base):
    __tablename__ = "website_email_configs"

    # Use UUID and server_default to match your other tables
    config_id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    website_id = Column(UUID(as_uuid=True), ForeignKey("websites.website_id", ondelete="CASCADE"), unique=True, nullable=False)
    
    provider_type = Column(String(50), nullable=False)  # 'smtp' or 'sendgrid'
    
    # Common Fields
    from_email = Column(String(255), nullable=False)
    from_name = Column(String(255), nullable=False)
    
    # SMTP Fields
    smtp_host = Column(String(255), nullable=True)
    smtp_port = Column(Integer, nullable=True)
    smtp_user = Column(String(255), nullable=True)
    smtp_password = Column(String(255), nullable=True) 
    smtp_secure = Column(Boolean, default=True)

    # SendGrid Fields
    sendgrid_api_key = Column(String(255), nullable=True)

    # Relationship back to Website
    website = relationship("Website", back_populates="email_config")
#endregion
