from fastapi import APIRouter, Depends, HTTPException, status
from uuid import UUID
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from typing import List

from database import get_db
from models import MenuItem, Category, Location
from schemas import MenuItemCreate, MenuItemResponse, MenuItemUpdate
from auth.auth_handler import get_current_active_user
from models import User


router = APIRouter(prefix="/menu-items", tags=["Menu Items"])


@router.post("/", response_model=MenuItemResponse, status_code=status.HTTP_201_CREATED)
async def create_menu_item(
    payload: MenuItemCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Creates a new menu item for a given location and category.
    """
    # Optional: Check if category and location exist
    cat_res = await db.execute(select(Category).where(Category.id == payload.category_id))
    if not cat_res.scalars().first():
        raise HTTPException(status_code=404, detail=f"Category with id {payload.category_id} not found")

    loc_res = await db.execute(select(Location).where(Location.location_id == payload.location_id))
    if not loc_res.scalars().first():
        raise HTTPException(status_code=404, detail=f"Location with id {payload.location_id} not found")

    new_item = MenuItem(**payload.model_dump())
    db.add(new_item)
    await db.commit()
    await db.refresh(new_item)
    return new_item


@router.put("/{item_id}", response_model=MenuItemResponse)
async def update_menu_item(
    item_id: UUID,
    payload: MenuItemUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Updates an existing menu item.
    """
    result = await db.execute(select(MenuItem).where(MenuItem.item_id == item_id))
    db_item = result.scalars().first()

    if not db_item:
        raise HTTPException(status_code=404, detail="Menu item not found")

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(db_item, field, value)

    await db.commit()
    await db.refresh(db_item)
    return db_item


@router.delete("/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_menu_item(
    item_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Deletes a menu item.
    """
    result = await db.execute(select(MenuItem).where(MenuItem.item_id == item_id))
    db_item = result.scalars().first()

    if not db_item:
        raise HTTPException(status_code=404, detail="Menu item not found")

    await db.delete(db_item)
    await db.commit()

    return None # Return None for 204 No Content response