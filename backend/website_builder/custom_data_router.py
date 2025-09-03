from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from uuid import UUID
from typing import List, Dict, Any, Optional

from database import get_db
from models import User, CustomDataSchema, CustomDataRow
from auth.auth_handler import get_current_active_user
from website_builder.router import get_website_and_check_ownership

router = APIRouter(prefix="/custom-data", tags=["Custom Data"])

# --- (Your Pydantic Schemas should be in this file or imported) ---
class SchemaField(BaseModel):
    id: str
    label: str
    type: str

class SchemaCreate(BaseModel):
    website_id: UUID
    name: str
    fields: List[SchemaField]

class SchemaResponse(BaseModel):
    schema_id: UUID
    name: str
    fields: List[SchemaField]
    class Config: from_attributes = True

class RowCreate(BaseModel):
    data: Dict[str, Any]
    sitemember_id: Optional[UUID] = None # ✅ This makes it optional
    
class RowUpdate(BaseModel):
    data: Dict[str, Any]
    sitemember_id: UUID # Required to verify ownership


class RowResponse(BaseModel):
    row_id: UUID
    data: Dict[str, Any]
    class Config: from_attributes = True

# --- Helper for Ownership Check ---
async def get_schema_and_check_ownership(schema_id: UUID, user: User, db: AsyncSession) -> CustomDataSchema:
    result = await db.execute(select(CustomDataSchema).where(CustomDataSchema.schema_id == schema_id))
    schema = result.scalars().first()
    if not schema:
        raise HTTPException(status_code=404, detail="Schema not found.")
    await get_website_and_check_ownership(schema.website_id, user, db)
    return schema
    
# =======================================================
# === WEBSITE OWNER Endpoints (PRIVATE, requires login) ===
# =======================================================

@router.post("/schemas", status_code=201, response_model=SchemaResponse)
async def create_data_schema(
    schema_data: SchemaCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Creates a new data schema (a "custom table") for a website.
    Only the website owner can do this.
    """
    await get_website_and_check_ownership(schema_data.website_id, current_user, db)
    new_schema = CustomDataSchema(
        website_id=schema_data.website_id,
        name=schema_data.name,
        fields=[field.model_dump() for field in schema_data.fields]
    )
    db.add(new_schema)
    await db.commit()
    await db.refresh(new_schema)
    return new_schema

@router.get("/schemas/website/{website_id}", response_model=List[SchemaResponse])
async def get_schemas_for_website(
    website_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Gets a list of all custom data schemas for a specific website.
    Only the website owner can do this.
    """
    await get_website_and_check_ownership(website_id, current_user, db)
    result = await db.execute(
        select(CustomDataSchema).where(CustomDataSchema.website_id == website_id)
    )
    return result.scalars().all()

@router.get("/rows/{schema_id}", response_model=List[RowResponse])
async def get_rows_for_schema(
    schema_id: UUID,
    db: AsyncSession = Depends(get_db),
    # NO current_user dependency here
):
    """
    Gets all the data rows (submissions) for a specific schema.
    This is public so the live site can display the data.
    """
    result = await db.execute(
        select(CustomDataRow)
        .where(CustomDataRow.schema_id == schema_id)
        .order_by(CustomDataRow.created_at.desc())
    )
    rows = result.scalars().all()
    return [
        {
            "row_id": row.row_id,
            "schema_id": row.schema_id,
            "data": row.data,
            "created_at": row.created_at
        }
        for row in rows
    ]
    
# =======================================================
# === SITE MEMBER Endpoints (PUBLIC with internal checks) ===
# =======================================================

@router.post("/rows/{schema_id}", status_code=201)
async def add_data_row(
    schema_id: UUID,
    row_data: RowCreate,
    db: AsyncSession = Depends(get_db)
):
    new_row = CustomDataRow(
        schema_id=schema_id, 
        data=row_data.data,
        sitemember_id=row_data.sitemember_id # ✅ This correctly saves either the ID or None
    )
    db.add(new_row)
    await db.commit()
    return {"status": "success"}

@router.put("/rows/{row_id}", response_model=RowResponse)
async def update_data_row(
    row_id: UUID,
    row_data: RowUpdate,
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(CustomDataRow).where(CustomDataRow.row_id == row_id))
    row_to_update = result.scalars().first()
    if not row_to_update:
        raise HTTPException(status_code=404, detail="Row not found.")
    
    # SECURITY CHECK: Only allow update if the sitemember_id matches
    if row_to_update.sitemember_id != row_data.sitemember_id:
        raise HTTPException(status_code=403, detail="You do not have permission to update this row.")
    
    row_to_update.data = row_data.data
    await db.commit()
    await db.refresh(row_to_update)
    return row_to_update

@router.delete("/rows/{row_id}", status_code=204)
async def delete_data_row(
    row_id: UUID,
    sitemember_id: UUID, # The frontend must provide the ID of the user trying to delete
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(CustomDataRow).where(CustomDataRow.row_id == row_id))
    row_to_delete = result.scalars().first()
    if not row_to_delete:
        raise HTTPException(status_code=404, detail="Row not found.")
    
    # SECURITY CHECK: Only allow deletion if the sitemember_id matches
    if row_to_delete.sitemember_id != sitemember_id:
        raise HTTPException(status_code=403, detail="You do not have permission to delete this row.")
    
    await db.delete(row_to_delete)
    await db.commit()
    return None






