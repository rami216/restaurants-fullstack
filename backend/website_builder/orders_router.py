from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from uuid import UUID
from typing import List

from database import get_db
from models import User, WebsiteOrder
from auth.auth_handler import get_current_active_user
from website_builder.router import get_website_and_check_ownership # Reuse your ownership checker
from website_builder import schemas # Import your schemas
from models import RestaurantOwner, Website
from sqlalchemy.orm import selectinload

router = APIRouter(prefix="/orders", tags=["Website Orders"])





@router.get("/my-orders", response_model=List[schemas.WebsiteOrderResponse])
async def get_my_orders(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    # Find the owner and their associated website in a single, efficient query
    result = await db.execute(
        select(RestaurantOwner)
        .options(selectinload(RestaurantOwner.website))
        .where(RestaurantOwner.user_id == current_user.id)
    )
    owner = result.scalars().first()

    # If the owner or their website doesn't exist, return an empty list
    if not owner or not owner.website:
        return []

    # Fetch all orders for that single website, newest first
    orders_result = await db.execute(
        select(WebsiteOrder)
        .where(WebsiteOrder.website_id == owner.website.website_id)
        .order_by(WebsiteOrder.created_at.desc())
    )
    orders = orders_result.scalars().all()
    
    return orders