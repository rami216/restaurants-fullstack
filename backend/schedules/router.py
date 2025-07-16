# schedules/router.py

from fastapi import APIRouter, Depends, HTTPException, status
from uuid import UUID
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from typing import List

from database import get_db
from models import Schedule, Location, User
from schemas import ScheduleCreate, ScheduleResponse, ScheduleUpdate
from auth.auth_handler import get_current_active_user

router = APIRouter(prefix="/schedules", tags=["Schedules"])


@router.get("/by-location/{location_id}", response_model=List[ScheduleResponse])
async def get_schedules_by_location(
    location_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Retrieves all schedules for a specific location.
    """
    result = await db.execute(
        select(Schedule).where(Schedule.location_id == location_id)
    )
    return result.scalars().all()


@router.post("/", response_model=ScheduleResponse, status_code=status.HTTP_201_CREATED)
async def create_schedule(
    payload: ScheduleCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Creates a new schedule for a given location.
    """
    new_schedule = Schedule(**payload.model_dump())
    db.add(new_schedule)
    await db.commit()
    await db.refresh(new_schedule)
    return new_schedule


@router.put("/{schedule_id}", response_model=ScheduleResponse)
async def update_schedule(
    schedule_id: UUID,
    payload: ScheduleUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Updates a schedule by its unique ID.
    """
    result = await db.execute(select(Schedule).where(Schedule.schedule_id == schedule_id))
    db_schedule = result.scalars().first()

    if not db_schedule:
        raise HTTPException(status_code=404, detail="Schedule not found")

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(db_schedule, field, value)

    await db.commit()
    await db.refresh(db_schedule)
    return db_schedule


@router.delete("/{schedule_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_schedule(
    schedule_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Deletes a schedule by its unique ID.
    """
    result = await db.execute(select(Schedule).where(Schedule.schedule_id == schedule_id))
    db_schedule = result.scalars().first()

    if not db_schedule:
        raise HTTPException(status_code=404, detail="Schedule not found")

    await db.delete(db_schedule)
    await db.commit()
    return None