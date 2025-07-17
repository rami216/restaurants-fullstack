# schemas.py
from pydantic import BaseModel, EmailStr,Field
from typing import Optional
from uuid import UUID
import datetime
from enum import Enum


class UserBase(BaseModel):
    username: str
    email: EmailStr

class UserCreate(UserBase):
    password: str

class UserResponse(UserBase):
    id: int
    is_active: bool

    class Config:
        orm_mode = True

class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    username: str | None = None

class ConfirmEmailRequest(BaseModel):
    email: str
    code: str

class RestaurantCreate(BaseModel):
    owner_email: Optional[str] = None
    owner_name: Optional[str] = None
    
    
class RestaurantBrandCreate(BaseModel):
    name: str

class RestaurantBrandResponse(BaseModel):
    brand_id: UUID
    name: str
    restaurant_id: UUID

    class Config:
        orm_mode = True
        
class LocationCreate(BaseModel):
    brand_id: UUID
    location_name: str
    address: Optional[str] = None
    phone_number: Optional[str] = None
    maps_link: Optional[str] = None
    location_owner_email: Optional[str] = None
    restaurant_id: UUID
    registered_date: Optional[datetime.datetime] = None
    end_date: Optional[datetime.datetime] = None
    delivery_available: bool = False
    dine_in: bool = False

class LocationResponse(BaseModel):
    location_id: UUID
    brand_id: UUID
    location_name: str
    address: Optional[str]
    phone_number: Optional[str]
    maps_link: Optional[str]
    location_owner_email: Optional[str]
    created_at: Optional[datetime.datetime]
    updated_at: Optional[datetime.datetime]
    restaurant_id: UUID
    registered_date: Optional[datetime.datetime]
    end_date: Optional[datetime.datetime]
    delivery_available: bool
    dine_in: bool

    class Config:
        from_attributes = True
        
class LocationUpdate(BaseModel):
    location_name: Optional[str] = None
    address: Optional[str] = None
    phone_number: Optional[str] = None
    maps_link: Optional[str] = None
    location_owner_email: Optional[str] = None
    delivery_available: Optional[bool] = None
    dine_in: Optional[bool] = None
        
class CategoryCreate(BaseModel):
    name: str
    restaurant_id: UUID
    image_url: Optional[str] = None # <-- ADDED


class CategoryResponse(BaseModel):
    id: int
    restaurant_id: UUID
    name: str
    image_url: Optional[str] = None # <-- ADDED
    created_at: Optional[datetime.datetime]

    class Config:
        from_attributes = True
        
class CategoryUpdate(BaseModel):
    name: str
    image_url: Optional[str] = None # <-- ADDED

class MenuItemBase(BaseModel):
    item_name: str
    description: Optional[str] = None
    base_price: float
    is_available: bool = True
    image_url: Optional[str] = None
    category_id: int
    location_id: UUID

class MenuItemCreate(MenuItemBase):
    pass

class MenuItemUpdate(BaseModel):
    item_name: Optional[str] = None
    description: Optional[str] = None
    base_price: Optional[float] = None
    is_available: Optional[bool] = None
    image_url: Optional[str] = None
    category_id: Optional[int] = None

class MenuItemResponse(MenuItemBase):
    item_id: UUID
    created_at: datetime.datetime
    updated_at: Optional[datetime.datetime] = None

    class Config:
        from_attributes = True
        
        
class ExtraBase(BaseModel):
    name: str
    price: float
    description: Optional[str] = None
    is_active: bool = True
    location_id: UUID

class ExtraCreate(ExtraBase):
    pass

class ExtraUpdate(BaseModel):
    name: Optional[str] = None
    price: Optional[float] = None
    description: Optional[str] = None
    is_active: Optional[bool] = None

class ExtraResponse(ExtraBase):
    extra_id: UUID
    created_at: datetime.datetime
    updated_at: Optional[datetime.datetime] = None

    class Config:
        from_attributes = True
        
class MenuItemExtraCreate(BaseModel):
    menu_item_id: UUID
    extra_id: UUID

class MenuItemExtraResponse(BaseModel):
    menu_item_extra_id: UUID
    menu_item_id: UUID
    extra_id: UUID
    created_at: datetime.datetime

    class Config:
        from_attributes = True
        
class OptionGroupBase(BaseModel):
    group_name: str
    min_choices: Optional[int] = 0
    max_choices: Optional[int] = 1
    is_required: bool = False
    location_id: UUID

class OptionGroupCreate(OptionGroupBase):
    pass

class OptionGroupUpdate(BaseModel):
    group_name: Optional[str] = None
    min_choices: Optional[int] = None
    max_choices: Optional[int] = None
    is_required: Optional[bool] = None

class OptionGroupResponse(OptionGroupBase):
    group_id: UUID
    created_at: datetime.datetime
    updated_at: Optional[datetime.datetime] = None

    class Config:
        from_attributes = True
        
class OptionChoiceBase(BaseModel):
    name: str
    price_adjustment: Optional[float] = 0.00
    is_active: bool = True
    group_id: UUID
    location_id: UUID

class OptionChoiceCreate(OptionChoiceBase):
    pass

class OptionChoiceUpdate(BaseModel):
    name: Optional[str] = None
    price_adjustment: Optional[float] = None
    is_active: Optional[bool] = None
    group_id: Optional[UUID] = None # Allow changing the group

class OptionChoiceResponse(OptionChoiceBase):
    choice_id: UUID
    created_at: datetime.datetime
    updated_at: Optional[datetime.datetime] = None

    class Config:
        from_attributes = True
        
class MenuItemOptionCreate(BaseModel):
    menu_item_id: UUID
    group_id: UUID

class MenuItemOptionResponse(BaseModel):
    menu_item_option_id: UUID
    menu_item_id: UUID
    group_id: UUID
    created_at: datetime.datetime

    class Config:
        from_attributes = True
        
        
class DayOfWeekEnum(str, Enum):
    Monday = "Monday"
    Tuesday = "Tuesday"
    Wednesday = "Wednesday"
    Thursday = "Thursday"
    Friday = "Friday"
    Saturday = "Saturday"
    Sunday = "Sunday"

class ScheduleBase(BaseModel):
    day_of_week: DayOfWeekEnum
    open_time: Optional[datetime.time] = None
    close_time: Optional[datetime.time] = None
    is_closed: bool = False
    notes: Optional[str] = None
    location_id: UUID

class ScheduleCreate(ScheduleBase):
    pass

class ScheduleUpdate(BaseModel):
    day_of_week: Optional[DayOfWeekEnum] = None
    open_time: Optional[datetime.time] = None
    close_time: Optional[datetime.time] = None
    is_closed: Optional[bool] = None
    notes: Optional[str] = None

class ScheduleResponse(ScheduleBase):
    schedule_id: UUID
    created_at: datetime.datetime
    updated_at: Optional[datetime.datetime] = None

    class Config:
        from_attributes = True
        
        
class CheckoutSessionResponse(BaseModel):
    sessionId: str

class BillingPortalResponse(BaseModel):
    url: str

class TopUpRequest(BaseModel):
    # The amount the user wants to add, in dollars.
    # We use Field(gt=0) to ensure the amount is positive.
    amount: float = Field(..., gt=0, description="The amount to add in dollars.")
