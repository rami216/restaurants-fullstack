# website_builder/site_auth_models.py
from sqlalchemy import Column, String, Boolean, DateTime, ForeignKey, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func, text
from sqlalchemy.orm import relationship
from database import Base
from .models import Website

class SiteMember(Base):
    __tablename__ = "site_members"

    member_id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    website_id = Column(UUID(as_uuid=True), ForeignKey("websites.website_id"), nullable=False, index=True)
    email = Column(String, nullable=False)
    password_hash = Column(String, nullable=True)
    is_active = Column(Boolean, nullable=False, default=True)
    role = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    is_active = Column(Boolean, default=False)
    confirmation_code = Column(String, nullable=True) # Renamed from token
    confirmation_code_expires = Column(DateTime, nullable=True) # Renamed from to
    google_id = Column(String, nullable=True, unique=True)
    website = relationship("Website")
    __table_args__ = (UniqueConstraint("website_id", "email", name="uq_site_member_email_per_site"),)
