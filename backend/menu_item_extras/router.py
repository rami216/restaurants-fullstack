# menu_item_extras/router.py

from fastapi import APIRouter, Depends, HTTPException, status
from uuid import UUID
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from typing import List

from database import get_db
from models import MenuItemExtra, MenuItem, Extra, User
from schemas import MenuItemExtraCreate, MenuItemExtraResponse, ExtraResponse
from auth.auth_handler import get_current_active_user

router = APIRouter(prefix="/menu-item-extras", tags=["Menu Item Extras"])


@router.get("/by-location/{location_id}", response_model=List[MenuItemExtraResponse])
async def get_all_menu_item_extras_by_location(
    location_id: UUID,
    db: AsyncSession = Depends(get_db)
):
    """
    Gets all menu_item_extra links for a specific location.
    This is useful for seeing all connections at once for a location.
    """
    # This query joins MenuItemExtra with MenuItem and filters by location_id
    result = await db.execute(
        select(MenuItemExtra)
        .join(MenuItem, MenuItemExtra.menu_item_id == MenuItem.item_id)
        .where(MenuItem.location_id == location_id)
    )
    
    links = result.scalars().all()
    return links

@router.post("/", response_model=MenuItemExtraResponse, status_code=status.HTTP_201_CREATED)
async def link_extra_to_menu_item(
    payload: MenuItemExtraCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Creates a link between a menu item and an extra.
    """
    # Optional but recommended: Check if the link already exists
    existing_link = await db.execute(
        select(MenuItemExtra).where(
            MenuItemExtra.menu_item_id == payload.menu_item_id,
            MenuItemExtra.extra_id == payload.extra_id
        )
    )
    if existing_link.scalars().first():
        raise HTTPException(status_code=409, detail="This extra is already linked to the menu item.")

    new_link = MenuItemExtra(**payload.model_dump())
    db.add(new_link)
    await db.commit()
    await db.refresh(new_link)
    return new_link


@router.get("/extras-for-item/{menu_item_id}", response_model=List[ExtraResponse])
async def get_extras_for_menu_item(
    menu_item_id: UUID,
    db: AsyncSession = Depends(get_db)
):
    """
    Gets all extras that are linked to a specific menu item.
    """
    result = await db.execute(
        select(MenuItem).options(selectinload(MenuItem.extras)).where(MenuItem.item_id == menu_item_id)
    )
    menu_item = result.scalars().first()

    if not menu_item:
        raise HTTPException(status_code=404, detail="Menu item not found")

    return menu_item.extras


@router.delete("/{menu_item_extra_id}", status_code=status.HTTP_204_NO_CONTENT)
async def unlink_extra_from_menu_item(
    menu_item_extra_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Deletes a specific link between a menu item and an extra.
    """
    result = await db.execute(
        select(MenuItemExtra).where(MenuItemExtra.menu_item_extra_id == menu_item_extra_id)
    )
    link_to_delete = result.scalars().first()

    if not link_to_delete:
        raise HTTPException(status_code=404, detail="Link not found")

    await db.delete(link_to_delete)
    await db.commit()
    return None