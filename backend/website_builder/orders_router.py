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

router = APIRouter(prefix="/orders", tags=["Website Orders"])





@router.get("/website/{website_id}", response_model=List[schemas.WebsiteOrderResponse])
async def get_orders_for_website(
    website_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    # This correctly verifies that the logged-in user owns the website
    await get_website_and_check_ownership(website_id, current_user, db)
    
    result = await db.execute(
        select(WebsiteOrder)
        .where(WebsiteOrder.website_id == website_id)
        .order_by(WebsiteOrder.created_at.desc())
    )
    orders = result.scalars().all()
    
    return orders
