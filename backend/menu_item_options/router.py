# menu_item_options/router.py

from fastapi import APIRouter, Depends, HTTPException, status
from uuid import UUID
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from typing import List

from database import get_db
from models import MenuItemOption, MenuItem, OptionGroup, User
from schemas import MenuItemOptionCreate, MenuItemOptionResponse
from auth.auth_handler import get_current_active_user

router = APIRouter(prefix="/menu-item-options", tags=["Menu Item Options"])


@router.get("/by-location/{location_id}", response_model=List[MenuItemOptionResponse])
async def get_menu_item_options_by_location(
    location_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Gets all menu_item_option links for a specific location by joining through menu_items.
    """
    result = await db.execute(
        select(MenuItemOption)
        .join(MenuItem, MenuItemOption.menu_item_id == MenuItem.item_id)
        .where(MenuItem.location_id == location_id)
    )
    return result.scalars().all()


@router.post("/", response_model=MenuItemOptionResponse, status_code=status.HTTP_201_CREATED)
async def link_menu_item_to_option_group(
    payload: MenuItemOptionCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Creates a link between a menu item and an option group.
    """
    # Optional: Check if the link already exists
    existing_link = await db.execute(
        select(MenuItemOption).where(
            MenuItemOption.menu_item_id == payload.menu_item_id,
            MenuItemOption.group_id == payload.group_id
        )
    )
    if existing_link.scalars().first():
        raise HTTPException(status_code=409, detail="This option group is already linked to the menu item.")

    new_link = MenuItemOption(**payload.model_dump())
    db.add(new_link)
    await db.commit()
    await db.refresh(new_link)
    return new_link


@router.delete("/{menu_item_option_id}", status_code=status.HTTP_204_NO_CONTENT)
async def unlink_menu_item_from_option_group(
    menu_item_option_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Deletes a specific link by its unique ID.
    """
    result = await db.execute(
        select(MenuItemOption).where(MenuItemOption.menu_item_option_id == menu_item_option_id)
    )
    link_to_delete = result.scalars().first()

    if not link_to_delete:
        raise HTTPException(status_code=404, detail="Link not found")

    await db.delete(link_to_delete)
    await db.commit()
    return None