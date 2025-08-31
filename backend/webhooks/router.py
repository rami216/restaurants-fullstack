from fastapi import APIRouter, Request, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
import json

from database import get_db
from models import RestaurantOwner

router = APIRouter(prefix="/webhooks", tags=["Webhooks"])

@router.post("/supabase")
async def supabase_webhook(
    request: Request,
    db: AsyncSession = Depends(get_db)
):
    try:
        payload = await request.json()
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid JSON payload")

    # We only care about new objects being created
    event_type = payload.get("type")
    table = payload.get("table")
    record = payload.get("record")

    if event_type != "INSERT" or table != "objects" or not record:
        return {"status": "ignored, not a new storage object"}

    try:
        # Safely get the path and metadata
        object_path = record.get("name")
        metadata = record.get("metadata", {})
        file_size = metadata.get("size")

        if not object_path or file_size is None:
            return {"status": "ignored, missing path or size"}

        # The user ID is the first part of the file path (e.g., "123/2025/...")
        user_id_str = object_path.split('/')[0]
        user_id = int(user_id_str)
        
    except (ValueError, IndexError, TypeError):
        print(f"Could not parse user_id or size from webhook payload for path: {object_path}")
        return {"status": "ignored, could not parse payload details"}

    # Find the owner and update their storage usage
    owner = await db.scalar(select(RestaurantOwner).where(RestaurantOwner.user_id == user_id))
    if owner:
        owner.storage_bytes_used = (owner.storage_bytes_used or 0) + file_size
        await db.commit()
        return {"status": "success, storage updated"}
    
    return {"status": "ignored, owner not found"}