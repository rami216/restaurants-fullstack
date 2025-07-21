#models.py
from sqlalchemy import Column, String, Integer, DateTime, ForeignKey, BigInteger,Boolean,text,Numeric,Time
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from database import Base
from sqlalchemy.orm import relationship
import sqlalchemy
import uuid
from website_builder.models import Website 

class User(Base):
    __tablename__ = "users"

    id              = Column(Integer, primary_key=True, index=True)
    username        = Column(String, unique=True, index=True, nullable=False)
    email           = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    is_active = Column(Boolean, default=False)
    confirmation_code = Column(String, nullable=True)
    
class RestaurantOwner(Base):
    __tablename__ = "restaurant_owners"

    restaurant_id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        server_default=text("gen_random_uuid()"),
    )
    owner_email = Column(String, nullable=True, default=None)
    owner_name = Column(String, nullable=True, default=None)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    total_prompt_tokens_consumed = Column(BigInteger, nullable=False, default=0)
    total_completion_tokens_consumed = Column(BigInteger, nullable=False, default=0)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    brands = relationship("RestaurantBrand", back_populates="restaurant")
    stripe_customer_id = Column(String, nullable=True, unique=True)
    stripe_subscription_id = Column(String, nullable=True, unique=True)
    subscription_status = Column(String, nullable=True)

    # --- NEW WALLET COLUMN ---
    # Use Numeric for precision with currency. Stores the balance in dollars.
    credit_balance = Column(Numeric(10, 4), nullable=False, default=0.0)
    website = relationship("Website", back_populates="restaurant", uselist=False, cascade="all, delete-orphan")
    

class RestaurantBrand(Base):
    __tablename__ = "restaurant_brands"

    brand_id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        server_default=text("gen_random_uuid()"),
    )
    restaurant_id = Column(
        UUID(as_uuid=True),
        ForeignKey("restaurant_owners.restaurant_id"),
    )
    name = Column(String, nullable=False)


    restaurant = relationship("RestaurantOwner", back_populates="brands")
    
class Location(Base):
    __tablename__ = "locations"

    location_id =Column(
        UUID(as_uuid=True),
        primary_key=True,
        server_default=text("gen_random_uuid()"),
    )
    brand_id = Column(UUID(as_uuid=True), ForeignKey("restaurant_brands.brand_id"), nullable=False)
    location_name = Column(String, nullable=False)
    address = Column(String, nullable=True)
    phone_number = Column(String, nullable=True)
    maps_link = Column(String, nullable=True)
    location_owner_email = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    restaurant_id = Column(UUID(as_uuid=True), ForeignKey("restaurant_owners.restaurant_id"), nullable=False)
    registered_date = Column(DateTime(timezone=True), nullable=True)
    end_date = Column(DateTime(timezone=True), nullable=True)
    delivery_available = Column(Boolean, nullable=False, default=False)
    dine_in = Column(Boolean, nullable=False, default=False)    
    menu_items = relationship("MenuItem", back_populates="location")
    extras = relationship("Extra", back_populates="location")
    option_groups = relationship("OptionGroup", back_populates="location")
    option_choices = relationship("OptionChoice", back_populates="location")
    schedules = relationship("Schedule", back_populates="location")

    
class Category(Base):
    __tablename__ = "categories"

    id = Column(Integer, primary_key=True, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    name = Column(String, nullable=False)
    restaurant_id = Column(UUID(as_uuid=True), ForeignKey("restaurant_owners.restaurant_id"))
    image_url = Column(String, nullable=True)
    # Add relationship to MenuItem
    menu_items = relationship("MenuItem", back_populates="category")
    


class MenuItem(Base):
    __tablename__ = "menu_items"

    item_id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        server_default=text("gen_random_uuid()"),
    )
    item_name = Column(String, nullable=False)
    description = Column(String, nullable=True)
    base_price = Column(Numeric(10, 2), nullable=False)
    is_available = Column(Boolean, default=True, nullable=False)
    image_url = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Foreign Keys
    location_id = Column(UUID(as_uuid=True), ForeignKey("locations.location_id"), nullable=False)
    category_id = Column(Integer, ForeignKey("categories.id"), nullable=False)

    # Relationships
    location = relationship("Location", back_populates="menu_items")
    category = relationship("Category", back_populates="menu_items")
    extras = relationship(
        "Extra",
        secondary="menu_item_extras", # The name of the association table
        back_populates="menu_items"
    )
    option_groups = relationship("OptionGroup", secondary="menu_item_options", back_populates="menu_items")


class Extra(Base):
    __tablename__ = "extras"

    extra_id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        server_default=text("gen_random_uuid()"),
    )
    name = Column(String, nullable=False)
    price = Column(Numeric(10, 2), nullable=False)
    description = Column(String, nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Foreign Key to locations table
    location_id = Column(UUID(as_uuid=True), ForeignKey("locations.location_id"), nullable=False)

    # Relationship to the Location model
    location = relationship("Location")
    menu_items = relationship(
        "MenuItem",
        secondary="menu_item_extras", # The name of the association table
        back_populates="extras"
    )

class MenuItemExtra(Base):
    __tablename__ = "menu_item_extras"

    menu_item_extra_id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        server_default=text("gen_random_uuid()"),
    )
    menu_item_id = Column(UUID(as_uuid=True), ForeignKey("menu_items.item_id"), nullable=False)
    extra_id = Column(UUID(as_uuid=True), ForeignKey("extras.extra_id"), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

class OptionGroup(Base):
    __tablename__ = "option_groups"

    group_id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        server_default=text("gen_random_uuid()"),
    )
    group_name = Column(String, nullable=False)
    min_choices = Column(Integer, nullable=True, default=0)
    max_choices = Column(Integer, nullable=True, default=1)
    is_required = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Foreign Key
    location_id = Column(UUID(as_uuid=True), ForeignKey("locations.location_id"), nullable=False)

    # Relationship
    location = relationship("Location", back_populates="option_groups")
    choices = relationship("OptionChoice", back_populates="group")
    menu_items = relationship("MenuItem", secondary="menu_item_options", back_populates="option_groups")
    

class OptionChoice(Base):
    __tablename__ = "option_choices"

    choice_id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        server_default=text("gen_random_uuid()"),
    )
    name = Column(String, nullable=False)
    price_adjustment = Column(Numeric(10, 2), nullable=True, default=0.00)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Foreign Keys
    group_id = Column(UUID(as_uuid=True), ForeignKey("option_groups.group_id"), nullable=False)
    location_id = Column(UUID(as_uuid=True), ForeignKey("locations.location_id"), nullable=False)

    # Relationships
    group = relationship("OptionGroup", back_populates="choices")
    location = relationship("Location", back_populates="option_choices")
    
    
class MenuItemOption(Base):
    __tablename__ = "menu_item_options"

    menu_item_option_id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        server_default=text("gen_random_uuid()"),
    )
    menu_item_id = Column(UUID(as_uuid=True), ForeignKey("menu_items.item_id"), nullable=False)
    group_id = Column(UUID(as_uuid=True), ForeignKey("option_groups.group_id"), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    

class Schedule(Base):
    __tablename__ = "schedules"

    schedule_id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        server_default=text("gen_random_uuid()"),
    )
    day_of_week = Column(String, nullable=False)
    open_time = Column(Time, nullable=True)
    close_time = Column(Time, nullable=True)
    is_closed = Column(Boolean, default=False, nullable=False)
    notes = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Foreign Key
    location_id = Column(UUID(as_uuid=True), ForeignKey("locations.location_id"), nullable=False)

    # Relationship
    location = relationship("Location", back_populates="schedules")