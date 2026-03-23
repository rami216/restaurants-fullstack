#website_builder/site_commerce_models.py

from sqlalchemy import Column, String, DateTime, ForeignKey, Numeric, Boolean, UniqueConstraint,Integer,Float,text
from sqlalchemy.dialects.postgresql import UUID,JSONB
from sqlalchemy.sql import func
from database import Base

class WebsiteStripeAccount(Base):
    __tablename__ = "website_stripe_accounts"

    account_id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    website_id = Column(UUID(as_uuid=True), ForeignKey("websites.website_id", ondelete="CASCADE"), nullable=False)
    
    stripe_secret_key = Column(String, nullable=False)
    stripe_webhook_secret = Column(String, nullable=False)
    stripe_publishable_key = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        UniqueConstraint("website_id", name="uq_website_stripe_account"),
    )

class SiteProduct(Base):
    __tablename__ = "site_products"

    # ← PRIMARY KEY you will use for gating
    product_id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())

    website_id = Column(UUID(as_uuid=True), ForeignKey("websites.website_id", ondelete="CASCADE"), nullable=False)

    # human-facing
    name = Column(String, nullable=False)
    description = Column(String, nullable=True)

    # Stripe references (for one-time checkout)
    stripe_product_id = Column(String, nullable=True)   # e.g. prod_...
    stripe_price_id   = Column(String, nullable=False)  # e.g. price_...

    # pricing snapshot (optional but handy)
    currency = Column(String, nullable=False, default="usd")
    amount_cents = Column(Numeric(10, 0), nullable=False)

    active = Column(Boolean, nullable=False, default=True)
    is_ai_product = Column(Boolean, nullable=False, server_default="false")

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        UniqueConstraint("website_id", "name", name="uq_site_products_website_name"),
    )


class SitePurchase(Base):
    __tablename__ = "site_purchases"

    purchase_id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())

    website_id = Column(UUID(as_uuid=True), ForeignKey("websites.website_id", ondelete="CASCADE"), nullable=False)
    member_id  = Column(UUID(as_uuid=True), ForeignKey("site_members.member_id", ondelete="CASCADE"), nullable=False)

    # ← FK to product you’re gating
    product_id = Column(UUID(as_uuid=True), ForeignKey("site_products.product_id", ondelete="CASCADE"), nullable=False)

    status = Column(String, nullable=False, default="paid")  # "paid", "refunded", etc.
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    # ✅ ADD THESE MISSING COLUMNS:
    payment_intent_id = Column(String, nullable=True) # To track the Stripe ID
    amount_paid = Column(Numeric(10, 2), nullable=True) # To store $20.00
    currency = Column(String, nullable=True) # To store 'usd'
    

class SiteMemberUsage(Base):
    __tablename__ = "site_member_usage"
    
    id = Column(Integer, primary_key=True, index=True)
    website_id = Column(UUID(as_uuid=True), index=True)
    member_id = Column(UUID(as_uuid=True), index=True) # The person visiting the live site
    
    # Track their specific usage
    ai_spend_usd = Column(Float, default=0.0)
    ai_calls_count = Column(Integer, default=0)

class ProductAutomation(Base):
    __tablename__ = "product_automations"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    website_id = Column(UUID(as_uuid=True), ForeignKey("websites.website_id", ondelete="CASCADE"), nullable=False)
    
    # The internal SiteProduct ID this automation is attached to
    product_id = Column(UUID(as_uuid=True), ForeignKey("site_products.product_id", ondelete="CASCADE"), nullable=False)
    
    # The ID of the Custom Data Table (Schema) they want to modify
    target_schema_id = Column(UUID(as_uuid=True), nullable=False)
    
    # E.g., "insert_row"
    action_type = Column(String, nullable=False, default="insert_row")
    
    # The JSON data to insert. Example: {"credits": 5, "sitemember_id": "{{member_id}}"}
    payload_template = Column(JSONB, nullable=False)