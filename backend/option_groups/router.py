# option_groups/router.py

from fastapi import APIRouter, Depends, HTTPException, status
from uuid import UUID
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from typing import List

from database import get_db
from models import OptionGroup, Location, User
from schemas import OptionGroupCreate, OptionGroupResponse, OptionGroupUpdate
from auth.auth_handler import get_current_active_user

router = APIRouter(prefix="/option-groups", tags=["Option Groups"])


@router.get("/by-location/{location_id}", response_model=List[OptionGroupResponse])
async def get_option_groups_by_location(
    location_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Retrieves all option groups for a specific location.
    """
    result = await db.execute(
        select(OptionGroup).where(OptionGroup.location_id == location_id)
    )
    return result.scalars().all()


@router.post("/", response_model=OptionGroupResponse, status_code=status.HTTP_201_CREATED)
async def create_option_group(
    payload: OptionGroupCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Creates a new option group for a given location.
    """
    # Optional: Check if location exists
    loc_res = await db.execute(select(Location).where(Location.location_id == payload.location_id))
    if not loc_res.scalars().first():
        raise HTTPException(status_code=404, detail=f"Location with id {payload.location_id} not found")

    new_group = OptionGroup(**payload.model_dump())
    db.add(new_group)
    await db.commit()
    await db.refresh(new_group)
    return new_group


@router.put("/{group_id}", response_model=OptionGroupResponse)
async def update_option_group(
    group_id: UUID,
    payload: OptionGroupUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Updates an option group by its unique ID.
    """
    result = await db.execute(select(OptionGroup).where(OptionGroup.group_id == group_id))
    db_group = result.scalars().first()

    if not db_group:
        raise HTTPException(status_code=404, detail="Option group not found")

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(db_group, field, value)

    await db.commit()
    await db.refresh(db_group)
    return db_group


@router.delete("/{group_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_option_group(
    group_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Deletes an option group by its unique ID.
    """
    result = await db.execute(select(OptionGroup).where(OptionGroup.group_id == group_id))
    db_group = result.scalars().first()

    if not db_group:
        raise HTTPException(status_code=404, detail="Option group not found")

    await db.delete(db_group)
    await db.commit()
    return None