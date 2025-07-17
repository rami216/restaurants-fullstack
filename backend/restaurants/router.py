#retaurants/router.py
from fastapi import APIRouter, Depends, HTTPException, status
from uuid import UUID
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from models import RestaurantOwner, RestaurantBrand, User,Category
from database import get_db
from auth.auth_handler import get_current_active_user
from schemas import RestaurantBrandCreate, RestaurantBrandResponse,RestaurantCreate,CategoryCreate,CategoryResponse,CategoryUpdate

router = APIRouter(prefix="/restaurants", tags=["restaurants"])

@router.get("/has-restaurant")
async def has_restaurant(
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(RestaurantOwner).where(RestaurantOwner.user_id == current_user.id)
    )
    owner = result.scalars().first()
    
    if owner:
        # Perform the consumption calculation
        prompt_cost = (owner.total_prompt_tokens_consumed * 0.15) / 1000000
        completion_cost = (owner.total_completion_tokens_consumed * 0.6) / 1000000
        total_consumption = prompt_cost + completion_cost
        remaining_balance = float(owner.credit_balance) - total_consumption
        return {
            "has_restaurant": True,
            "restaurant_id": str(owner.restaurant_id),
            "credit_balance": remaining_balance,
            "subscription_status": owner.subscription_status
        }
    else:
        return {
            "has_restaurant": False
        }


@router.post("/create")
async def create_restaurant(
    # The payload is now optional, as we get the info from the logged-in user
    payload: RestaurantCreate,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    # Check if this specific user already has a restaurant
    result = await db.execute(
        select(RestaurantOwner).where(RestaurantOwner.user_id == current_user.id)
    )
    existing_restaurant = result.scalars().first()

    if existing_restaurant:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User already has a restaurant."
        )

    # THE FIX: Use the authenticated user's email and username instead of the empty payload.
    # This guarantees the owner_email will be unique for each user.
    restaurant = RestaurantOwner(
        owner_email=current_user.email,
        owner_name=current_user.username, # Use username as a default name
        user_id=current_user.id
    )
    db.add(restaurant)
    await db.commit()
    await db.refresh(restaurant)

    return {
        "message": "Restaurant created successfully.",
        "restaurant_id": str(restaurant.restaurant_id),
    }
@router.get("/has-brand")
async def has_brand(
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(RestaurantOwner).where(RestaurantOwner.user_id == current_user.id)
    )
    owner = result.scalars().first()

    if not owner:
        return {"has_brand": False}

    result = await db.execute(
        select(RestaurantBrand).where(RestaurantBrand.restaurant_id == owner.restaurant_id)
    )
    brand = result.scalars().first()

    if brand:
        return {
        "has_brand": True,
        "brand_name": brand.name,
        "brand_id": str(brand.brand_id)   # convert UUID to string
            }
    else:
        return {
            "has_brand": False
        }

    
@router.post("/create-brand", response_model=RestaurantBrandResponse)
async def create_brand(
    payload: RestaurantBrandCreate,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    # Check if user has a restaurant
    result = await db.execute(
        select(RestaurantOwner).where(RestaurantOwner.user_id == current_user.id)
    )
    owner = result.scalars().first()

    if not owner:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User does not have a restaurant yet."
        )

    # Check if a brand already exists for this restaurant
    result = await db.execute(
        select(RestaurantBrand).where(RestaurantBrand.restaurant_id == owner.restaurant_id)
    )
    existing_brand = result.scalars().first()

    if existing_brand:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A brand already exists for this restaurant."
        )

    brand = RestaurantBrand(
        name=payload.name,
        restaurant_id=owner.restaurant_id,
    )


    
    db.add(brand)
    await db.commit()
    await db.refresh(brand)

    return brand


@router.get("/categories/{restaurant_id}", response_model=list[CategoryResponse])
async def get_categories_by_restaurant(
    restaurant_id: UUID, #<-- This UUID is now from Python's uuid module
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Category).where(Category.restaurant_id == restaurant_id)
    )
    categories = result.scalars().all()

    return categories



@router.post("/categories/", response_model=CategoryResponse)
async def create_category(
    payload: CategoryCreate,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    new_category = Category(
        name=payload.name,
        restaurant_id=payload.restaurant_id,
        image_url=payload.image_url
    )

    db.add(new_category)
    await db.commit()
    await db.refresh(new_category)

    return new_category


@router.delete("/{restaurant_id}/categories/{id}")
async def delete_category(
    restaurant_id: UUID,
    id: int,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    # check that category belongs to that restaurant
    result = await db.execute(
        select(Category).where(
            Category.id == id,
            Category.restaurant_id == restaurant_id
        )
    )
    category = result.scalars().first()

    if not category:
        raise HTTPException(status_code=404, detail="Category not found")

    await db.delete(category)
    await db.commit()
    return {"detail": "Category deleted successfully"}


@router.put("/{restaurant_id}/categories/{id}", response_model=CategoryResponse)
async def update_category(
    restaurant_id: UUID,
    id: int,
    payload: CategoryUpdate,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Category).where(
            Category.id == id,
            Category.restaurant_id == restaurant_id
        )
    )
    db_category = result.scalars().first()

    if not db_category:
        raise HTTPException(
            status_code=404, 
            detail="Category not found in this restaurant"
        )

    # Use model_dump to handle partial updates cleanly for both name and image_url
    update_data = payload.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_category, key, value)
    
    await db.commit()
    await db.refresh(db_category)

    return db_category

