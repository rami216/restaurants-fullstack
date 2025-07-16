# option_choices/router.py

from fastapi import APIRouter, Depends, HTTPException, status
from uuid import UUID
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from typing import List

from database import get_db
from models import OptionChoice, OptionGroup, Location, User
from schemas import OptionChoiceCreate, OptionChoiceResponse, OptionChoiceUpdate
from auth.auth_handler import get_current_active_user

router = APIRouter(prefix="/option-choices", tags=["Option Choices"])


@router.get("/by-location/{location_id}", response_model=List[OptionChoiceResponse])
async def get_option_choices_by_location(
    location_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Retrieves all option choices for a specific location.
    """
    result = await db.execute(
        select(OptionChoice).where(OptionChoice.location_id == location_id)
    )
    return result.scalars().all()


@router.post("/", response_model=OptionChoiceResponse, status_code=status.HTTP_201_CREATED)
async def create_option_choice(
    payload: OptionChoiceCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Creates a new option choice and links it to an option group.
    """
    # Optional: Check if the parent group exists
    group_res = await db.execute(select(OptionGroup).where(OptionGroup.group_id == payload.group_id))
    if not group_res.scalars().first():
        raise HTTPException(status_code=404, detail=f"Option Group with id {payload.group_id} not found")

    new_choice = OptionChoice(**payload.model_dump())
    db.add(new_choice)
    await db.commit()
    await db.refresh(new_choice)
    return new_choice


@router.put("/{choice_id}", response_model=OptionChoiceResponse)
async def update_option_choice(
    choice_id: UUID,
    payload: OptionChoiceUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Updates an option choice by its unique ID.
    """
    result = await db.execute(select(OptionChoice).where(OptionChoice.choice_id == choice_id))
    db_choice = result.scalars().first()

    if not db_choice:
        raise HTTPException(status_code=404, detail="Option choice not found")

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(db_choice, field, value)

    await db.commit()
    await db.refresh(db_choice)
    return db_choice


@router.delete("/{choice_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_option_choice(
    choice_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Deletes an option choice by its unique ID.
    """
    result = await db.execute(select(OptionChoice).where(OptionChoice.choice_id == choice_id))
    db_choice = result.scalars().first()

    if not db_choice:
        raise HTTPException(status_code=404, detail="Option choice not found")

    await db.delete(db_choice)
    await db.commit()
    return None