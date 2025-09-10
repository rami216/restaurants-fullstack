from fastapi import APIRouter, Depends, HTTPException,Query
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select,func
from uuid import UUID
from typing import List, Dict, Any, Optional

from database import get_db
from models import User, CustomDataSchema, CustomDataRow
from auth.auth_handler import get_current_active_user
from website_builder.router import get_website_and_check_ownership

router = APIRouter(prefix="/custom-data", tags=["Custom Data"])

# --- Schemas ---
class SchemaField(BaseModel):
    id: str
    label: str
    type: str
    related_schema_id: Optional[UUID] = None # <-- ADD THIS

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
    sitemember_id: Optional[UUID] = None
    
class RowUpdate(BaseModel):
    data: Dict[str, Any]
    sitemember_id: Optional[UUID] = None

class RowResponse(BaseModel):
    row_id: UUID
    data: Dict[str, Any] # This will now contain resolved nested data
    class Config: from_attributes = True
    
class PaginatedRowResponse(BaseModel):
    rows: List[RowResponse]
    total: int


# --- Helper for Ownership Check ---
async def get_schema_and_check_ownership(schema_id: UUID, user: User, db: AsyncSession) -> CustomDataSchema:
    schema = await db.get(CustomDataSchema, schema_id)
    if not schema:
        raise HTTPException(status_code=404, detail="Schema not found.")
    await get_website_and_check_ownership(schema.website_id, user, db)
    return schema
    
# --- WEBSITE OWNER Endpoints ---
@router.post("/schemas", status_code=201, response_model=SchemaResponse)
async def create_data_schema(
    schema_data: SchemaCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    await get_website_and_check_ownership(schema_data.website_id, current_user, db)
    
    # --- VALIDATION for relation fields ---
    for field in schema_data.fields:
        if field.type == "relation":
            if not field.related_schema_id:
                raise HTTPException(status_code=400, detail=f"Field '{field.label}' is a relation but has no related_schema_id.")
            
            related_schema = await db.get(CustomDataSchema, field.related_schema_id)
            if not related_schema or related_schema.website_id != schema_data.website_id:
                raise HTTPException(status_code=400, detail=f"related_schema_id for field '{field.label}' is invalid or does not belong to this website.")

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
    await get_website_and_check_ownership(website_id, current_user, db)
    result = await db.execute(
        select(CustomDataSchema).where(CustomDataSchema.website_id == website_id)
    )
    return result.scalars().all()


# --- THE NEW, MORE POWERFUL get_rows_for_schema ---
# @router.get("/rows/{schema_id}", response_model=List[RowResponse])
# async def get_rows_for_schema(
#     schema_id: UUID,
#     db: AsyncSession = Depends(get_db)
# ):
#     schema = await db.get(CustomDataSchema, schema_id)
#     if not schema:
#         raise HTTPException(status_code=404, detail="Schema not found.")
    
#     relation_fields = {
#         field['id']: UUID(field['related_schema_id'])
#         for field in schema.fields
#         if field.get('type') == 'relation' and field.get('related_schema_id')
#     }

#     result = await db.execute(
#         select(CustomDataRow)
#         .where(CustomDataRow.schema_id == schema_id)
#         .order_by(CustomDataRow.created_at.desc())
#     )
#     rows = result.scalars().all()

#     if not relation_fields:
#         return [RowResponse.from_orm(row) for row in rows]

#     ids_to_fetch = set()
#     for row in rows:
#         for field_id in relation_fields:
#             related_row_id = row.data.get(field_id)
#             if related_row_id:
#                 try:
#                     ids_to_fetch.add(UUID(related_row_id))
#                 except (ValueError, TypeError):
#                     pass

#     if not ids_to_fetch:
#          return [RowResponse.from_orm(row) for row in rows]

#     related_rows_result = await db.execute(
#         select(CustomDataRow).where(CustomDataRow.row_id.in_(ids_to_fetch))
#     )
#     related_rows_map = { str(row.row_id): RowResponse.from_orm(row).model_dump() for row in related_rows_result.scalars() }

#     final_response = []
#     for row in rows:
#         resolved_data = row.data.copy()
#         for field_id in relation_fields:
#             related_row_id = resolved_data.get(field_id)
#             if related_row_id and str(related_row_id) in related_rows_map:
#                 resolved_data[field_id] = related_rows_map[str(related_row_id)]
        
#         final_response.append(RowResponse(row_id=row.row_id, data=resolved_data))

#     return final_response

@router.get("/rows/{schema_id}", response_model=PaginatedRowResponse)
async def get_rows_for_schema(
    schema_id: UUID,
    db: AsyncSession = Depends(get_db),
    skip: int = Query(0, ge=0, description="Number of rows to skip"),
    limit: int = Query(20, ge=1, le=100, description="Number of rows to return")
):
    """
    Fetches rows for a given schema with pagination.
    """
    schema = await db.get(CustomDataSchema, schema_id)
    if not schema:
        raise HTTPException(status_code=404, detail="Schema not found.")

    # 1. Get the total count of rows for the frontend to calculate pages
    count_query = select(func.count(CustomDataRow.row_id)).where(CustomDataRow.schema_id == schema_id)
    total_result = await db.execute(count_query)
    total_rows = total_result.scalar_one()

    # 2. Get the paginated subset of rows
    result = await db.execute(
        select(CustomDataRow)
        .where(CustomDataRow.schema_id == schema_id)
        .order_by(CustomDataRow.created_at.desc())
        .offset(skip)
        .limit(limit)
    )
    rows = result.scalars().all()

    # 3. Identify which fields are relations to resolve them
    relation_fields = {
        field['id']: UUID(field['related_schema_id'])
        for field in schema.fields
        if field.get('type') == 'relation' and field.get('related_schema_id')
    }

    # If there are no relations, we can return early and efficiently
    if not relation_fields:
        return PaginatedRowResponse(
            rows=[RowResponse.from_orm(row) for row in rows],
            total=total_rows
        )

    
    # 4. Collect all related row IDs that need to be fetched
    ids_to_fetch = set()
    for row in rows:
        for field_id in relation_fields:
            related_row_id = row.data.get(field_id)
            if related_row_id:
                try:
                    ids_to_fetch.add(UUID(related_row_id))
                except (ValueError, TypeError):
                    pass # Ignore invalid UUIDs in data

    if not ids_to_fetch:
        # No valid related IDs were found, so we can return
        return PaginatedRowResponse(
            rows=[RowResponse.from_orm(row) for row in rows],
            total=total_rows
        )

    # 5. Fetch all the related rows in a single, efficient query
    related_rows_result = await db.execute(
        select(CustomDataRow).where(CustomDataRow.row_id.in_(ids_to_fetch))
    )
    # Create a mapping from ID to the full row object for easy lookup
    related_rows_map = { 
        str(row.row_id): RowResponse.from_orm(row).model_dump() 
        for row in related_rows_result.scalars() 
    }

    # 6. Build the final response, replacing relation IDs with the full nested objects
    final_response_rows = []
    for row in rows:
        resolved_data = row.data.copy()
        for field_id in relation_fields:
            related_row_id = resolved_data.get(field_id)
            if related_row_id and str(related_row_id) in related_rows_map:
                
                resolved_data[field_id] = related_rows_map[str(related_row_id)]
        
        final_response_rows.append(RowResponse(row_id=row.row_id, data=resolved_data))

    return PaginatedRowResponse(rows=final_response_rows, total=total_rows)





# --- SITE MEMBER Endpoints (No changes needed below) ---

@router.post("/rows/{schema_id}", status_code=201)
async def add_data_row(
    schema_id: UUID,
    row_data: RowCreate,
    db: AsyncSession = Depends(get_db)
):
    # This logic remains the same; it just stores the UUID.
    new_row = CustomDataRow(
        schema_id=schema_id, 
        data=row_data.data,
        sitemember_id=row_data.sitemember_id
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
    # This logic remains the same.
    row_to_update = await db.get(CustomDataRow, row_id)
    if not row_to_update:
        raise HTTPException(status_code=404, detail="Row not found.")
    
    if row_to_update.sitemember_id is not None:
        if row_to_update.sitemember_id != row_data.sitemember_id:
            raise HTTPException(status_code=403, detail="Permission denied: Incorrect owner ID.")
    
    row_to_update.data = row_data.data
    await db.commit()
    await db.refresh(row_to_update)
    return row_to_update


@router.delete("/rows/{row_id}", status_code=204)
async def delete_data_row(
    row_id: UUID,
    sitemember_id: Optional[str] = None,
    db: AsyncSession = Depends(get_db)
):
    # This logic remains the same.
    member_id_or_none: Optional[UUID] = None
    if sitemember_id and sitemember_id != "null":
        try:
            member_id_or_none = UUID(sitemember_id)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid sitemember_id format.")

    row_to_delete = await db.get(CustomDataRow, row_id)
    if not row_to_delete:
        return None
    
    if row_to_delete.sitemember_id is not None:
        if row_to_delete.sitemember_id != member_id_or_none:
            raise HTTPException(status_code=403, detail="Permission denied to delete this row.")
    
    await db.delete(row_to_delete)
    await db.commit()
    return None