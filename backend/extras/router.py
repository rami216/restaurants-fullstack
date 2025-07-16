# extras/router.py

from fastapi import APIRouter, Depends, HTTPException, status
from uuid import UUID
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from typing import List

from database import get_db
from models import Extra, Location, User # Make sure to import your models
from schemas import ExtraCreate, ExtraResponse, ExtraUpdate # Import your new schemas
from auth.auth_handler import get_current_active_user


router = APIRouter(prefix="/extras", tags=["Extras"])


@router.get("/by-location/{location_id}", response_model=List[ExtraResponse])
async def get_all_extras_by_location(
    location_id: UUID,
    db: AsyncSession = Depends(get_db),
    # Optional: secure this endpoint
    # current_user: User = Depends(get_current_active_user),
):
    """
    Retrieves all extras associated with a specific location ID.
    """
    result = await db.execute(
        select(Extra).where(Extra.location_id == location_id)
    )
    extras = result.scalars().all()
    return extras


@router.post("/", response_model=ExtraResponse, status_code=status.HTTP_201_CREATED)
async def create_extra(
    payload: ExtraCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Creates a new extra for a given location.
    """
    # Optional: Check if location exists
    loc_res = await db.execute(select(Location).where(Location.location_id == payload.location_id))
    if not loc_res.scalars().first():
        raise HTTPException(status_code=404, detail=f"Location with id {payload.location_id} not found")

    new_extra = Extra(**payload.model_dump())
    db.add(new_extra)
    await db.commit()
    await db.refresh(new_extra)
    return new_extra


@router.put("/{extra_id}", response_model=ExtraResponse)
async def update_extra(
    extra_id: UUID,
    payload: ExtraUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    Updates a specific extra by its unique ID.
    """
    result = await db.execute(select(Extra).where(Extra.extra_id == extra_id))
    db_extra = result.scalars().first()

    if not db_extra:
        raise HTTPException(status_code=404, detail="Extra not found")

    # Optional: Add security check to ensure the user owns the location this extra belongs to.

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(db_extra, field, value)

    await db.commit()
    await db.refresh(db_extra)
    return db_extra


@router.delete("/{extra_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_extra(
    extra_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    Deletes a specific extra by its unique ID.
    """
    result = await db.execute(select(Extra).where(Extra.extra_id == extra_id))
    db_extra = result.scalars().first()

    if not db_extra:
        raise HTTPException(status_code=404, detail="Extra not found")

    # Optional: Add security check here as well.

    await db.delete(db_extra)
    await db.commit()
    return None