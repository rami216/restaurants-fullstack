# In webhooks/router.py

from fastapi import APIRouter, Request, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import Optional

from database import get_db
from models import RestaurantOwner

router = APIRouter(prefix="/webhooks", tags=["Webhooks"])

# --- Pydantic Models to validate the incoming Supabase payload ---
class StorageObjectMetadata(BaseModel):
    size: int
    mimetype: str
    
class StorageObject(BaseModel):
    id: str
    name: str # This is the full path of the object
    bucket_id: str = Field(..., alias="bucketId")
    metadata: StorageObjectMetadata
    
class SupabaseWebhookPayload(BaseModel):
    type: str
    table: str
    record: StorageObject

@router.post("/supabase")
async def supabase_webhook(
    payload: SupabaseWebhookPayload,
    db: AsyncSession = Depends(get_db)
):
    # We only care about new objects being created
    if payload.type != "INSERT" or payload.table != "objects":
        return {"status": "ignored, not a new storage object"}

    try:
        # The user ID is the first part of the file path (e.g., "123/2025/...")
        user_id = int(payload.record.name.split('/')[0])
        file_size = payload.record.metadata.size
    except (ValueError, IndexError):
        print(f"Could not parse user_id from path: {payload.record.name}")
        return {"status": "ignored, could not parse user_id"}

    # Find the owner and update their storage usage
    owner = await db.scalar(select(RestaurantOwner).where(RestaurantOwner.user_id == user_id))
    if owner:
        owner.storage_bytes_used += file_size
        await db.commit()
        return {"status": "success, storage updated"}
    
    return {"status": "ignored, owner not found"}