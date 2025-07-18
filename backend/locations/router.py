from fastapi import APIRouter, Depends, HTTPException, status,Query
from uuid import UUID
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from database import get_db
from models import Location, RestaurantOwner, RestaurantBrand, User,MenuItem
from auth.auth_handler import get_current_active_user
from schemas import LocationCreate, LocationResponse,MenuItemResponse,LocationUpdate
from typing import List, Optional

router = APIRouter(prefix="/locations", tags=["locations"])

@router.get("/has-location", response_model=List[LocationResponse])
async def has_location(
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    # Find user's restaurant
    result = await db.execute(
        select(RestaurantOwner).where(RestaurantOwner.user_id == current_user.id)
    )
    restaurant = result.scalars().first()

    if not restaurant:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Restaurant not found for this user."
        )

    # Fetch locations
    result = await db.execute(
        select(Location).where(Location.restaurant_id == restaurant.restaurant_id)
    )
    locations = result.scalars().all()

    return locations


@router.post("/create-location", response_model=LocationResponse)
async def create_location(
    payload: LocationCreate,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    # Ensure the brand exists
    result = await db.execute(
        select(RestaurantBrand).where(RestaurantBrand.brand_id == payload.brand_id)
    )
    brand = result.scalars().first()

    if not brand:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Brand does not exist."
        )

    # Create the new location
    new_location = Location(
        brand_id=payload.brand_id,
        location_name=payload.location_name,
        address=payload.address,
        phone_number=payload.phone_number,
        maps_link=payload.maps_link,
        location_owner_email=payload.location_owner_email,
        restaurant_id=payload.restaurant_id,
        registered_date=payload.registered_date,
        end_date=payload.end_date,
        delivery_available=payload.delivery_available,
        dine_in=payload.dine_in,
    )

    db.add(new_location)
    await db.commit()
    await db.refresh(new_location)

    return new_location
@router.get("/locations/{location_id}", response_model=LocationResponse)
async def get_location_by_id(
    location_id: UUID,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Location).where(Location.location_id == location_id)
    )
    location = result.scalars().first()

    if not location:
        raise HTTPException(
            status_code=404, detail="Location not found"
        )

    return location
  
  
@router.put("/locations/{location_id}", response_model=LocationResponse)
async def update_location(
    location_id: UUID,
    updated_data: LocationUpdate, # USE THE NEW SCHEMA HERE
    db: AsyncSession = Depends(get_db),
    # current_user: User = Depends(get_current_active_user), # Optional: add security
):
    result = await db.execute(
        select(Location).where(Location.location_id == location_id)
    )
    location = result.scalars().first()

    if not location:
        raise HTTPException(status_code=404, detail="Location not found")

    # This loop will now correctly update only the fields that were sent
    for field, value in updated_data.model_dump(exclude_unset=True).items():
        setattr(location, field, value)

    await db.commit()
    await db.refresh(location)

    return location


@router.get("/{location_id}/menu", response_model=List[MenuItemResponse])
async def get_menu_by_location_id(
    location_id: UUID,
    category_id: Optional[int] = Query(None), # <-- ADDED THIS
    db: AsyncSession = Depends(get_db)
):
    """
    Retrieves all menu items for a specific location.
    Can be optionally filtered by category_id.
    """
    # Start the base query
    query = select(MenuItem).where(MenuItem.location_id == location_id)

    # If a category_id is provided, add another filter to the query
    if category_id is not None:
        query = query.where(MenuItem.category_id == category_id)

    # Execute the final query
    result = await db.execute(query)
    menu_items = result.scalars().all()
    return menu_items




