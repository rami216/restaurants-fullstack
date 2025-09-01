from fastapi import APIRouter, Request, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
import json

from database import get_db
from models import RestaurantOwner

router = APIRouter(prefix="/webhooks", tags=["Webhooks"])

# @router.post("/supabase")
# async def supabase_webhook(
#     request: Request,
#     db: AsyncSession = Depends(get_db)
# ):
#     try:
#         payload = await request.json()
#     except json.JSONDecodeError:
#         raise HTTPException(status_code=400, detail="Invalid JSON payload")

#     # We only care about new objects being created
#     event_type = payload.get("type")
#     table = payload.get("table")
#     record = payload.get("record")

#     if event_type != "INSERT" or table != "objects" or not record:
#         return {"status": "ignored, not a new storage object"}

#     try:
#         # Safely get the path and metadata
#         object_path = record.get("name")
#         metadata = record.get("metadata", {})
#         file_size = metadata.get("size")

#         if not object_path or file_size is None:
#             return {"status": "ignored, missing path or size"}

#         # The user ID is the first part of the file path (e.g., "123/2025/...")
#         user_id_str = object_path.split('/')[0]
#         user_id = int(user_id_str)
        
#     except (ValueError, IndexError, TypeError):
#         print(f"Could not parse user_id or size from webhook payload for path: {object_path}")
#         return {"status": "ignored, could not parse payload details"}

#     # Find the owner and update their storage usage
#     owner = await db.scalar(select(RestaurantOwner).where(RestaurantOwner.user_id == user_id))
#     if owner:
#         owner.storage_bytes_used = (owner.storage_bytes_used or 0) + file_size
#         await db.commit()
#         return {"status": "success, storage updated"}
    
#     return {"status": "ignored, owner not found"}


@router.post("/supabase")
async def supabase_webhook(
    request: Request,
    db: AsyncSession = Depends(get_db)
):
    try:
        payload = await request.json()
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid JSON payload")

    event_type = payload.get("type")
    table = payload.get("table")

    if table != "objects":
        return {"status": "ignored, not a storage object event"}

    # --- HANDLE FILE CREATION ---
    if event_type == "INSERT":
        record = payload.get("record")
        if not record:
            return {"status": "ignored, no record found in insert event"}
        
        try:
            object_path = record.get("name")
            metadata = record.get("metadata", {})
            file_size = metadata.get("size")

            if not object_path or file_size is None:
                return {"status": "ignored, missing path or size"}

            user_id_str = object_path.split('/')[0]
            user_id = int(user_id_str)
            
        except (ValueError, IndexError, TypeError):
            print(f"Could not parse user_id or size from INSERT payload for path: {object_path}")
            return {"status": "ignored, could not parse payload details"}

        owner = await db.scalar(select(RestaurantOwner).where(RestaurantOwner.user_id == user_id))
        if owner:
            owner.storage_bytes_used = (owner.storage_bytes_used or 0) + file_size
            await db.commit()
            return {"status": "success, storage updated on insert"}
        
        return {"status": "ignored, owner not found for insert"}

    # --- HANDLE FILE DELETION ---
    elif event_type == "DELETE":
        old_record = payload.get("old_record")
        if not old_record:
            return {"status": "ignored, no old_record found in delete event"}
        
        try:
            object_path = old_record.get("name")
            metadata = old_record.get("metadata", {})
            file_size = metadata.get("size")

            if not object_path or file_size is None:
                return {"status": "ignored, missing path or size in old_record"}

            user_id_str = object_path.split('/')[0]
            user_id = int(user_id_str)
        except (ValueError, IndexError, TypeError):
            print(f"Could not parse user_id from deleted path: {object_path}")
            return {"status": "ignored, could not parse payload"}
            
        owner = await db.scalar(select(RestaurantOwner).where(RestaurantOwner.user_id == user_id))
        if owner:
            owner.storage_bytes_used = max(0, (owner.storage_bytes_used or 0) - file_size)
            await db.commit()
            return {"status": "success, storage updated on delete"}
        
        return {"status": "ignored, owner not found for delete"}

    return {"status": "ignored, event type not handled"}
