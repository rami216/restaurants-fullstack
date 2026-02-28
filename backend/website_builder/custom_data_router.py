from fastapi import APIRouter, Depends, HTTPException,Query
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select,func,Float
from uuid import UUID
from typing import List, Dict, Any, Optional

from database import get_db
from models import User, CustomDataSchema, CustomDataRow
from auth.auth_handler import get_current_active_user
from website_builder.router import get_website_and_check_ownership
from .site_commerce_models import SiteMemberUsage
from .models import Website
from typing import Literal
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



@router.get("/rows/{schema_id}", response_model=PaginatedRowResponse)
async def get_rows_for_schema(
    schema_id: UUID,
    db: AsyncSession = Depends(get_db),
    skip: int = Query(0, ge=0, description="Number of rows to skip"),
    # ✅ THE FIX: Increased the maximum limit to 1000
    limit: int = Query(20, ge=1, le=1000, description="Number of rows to return"),
    sitemember_id: Optional[UUID] = Query(None, description="Filter by site member ID")  # ✅ ADD THIS
):
    """
    Fetches rows for a given schema with pagination.
    """
    schema = await db.get(CustomDataSchema, schema_id)
    if not schema:
        raise HTTPException(status_code=404, detail="Schema not found.")

    # 1. Get the total count of rows for the frontend to calculate pages
    # count_query = select(func.count(CustomDataRow.row_id)).where(CustomDataRow.schema_id == schema_id)
    # total_result = await db.execute(count_query)
    # total_rows = total_result.scalar_one()

    # # 2. Get the paginated subset of rows
    # result = await db.execute(
    #     select(CustomDataRow)
    #     .where(CustomDataRow.schema_id == schema_id)
    #     .order_by(CustomDataRow.created_at.desc())
    #     .offset(skip)
    #     .limit(limit)
    # )
    # rows = result.scalars().all()
    base_query = select(CustomDataRow).where(CustomDataRow.schema_id == schema_id)
    
    # ✅ ADD THIS: Filter by sitemember_id if provided
    if sitemember_id is not None:
        base_query = base_query.where(CustomDataRow.sitemember_id == sitemember_id)

    # 2. Get the total count
    count_query = select(func.count(CustomDataRow.row_id)).select_from(base_query.subquery())
    total_result = await db.execute(count_query)
    total_rows = total_result.scalar_one()

    # 3. Get the paginated subset
    result = await db.execute(
        base_query
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
    row_to_update = await db.get(CustomDataRow, row_id)
    if not row_to_update:
        raise HTTPException(status_code=404, detail="Row not found.")
    
    # --- START OF NEW LOGIC ---
    
    ADMIN_OVERRIDE_UUID = "00000000-0000-0000-0000-000000000000"
    
    # 1. Check if the REQUESTER is the Admin
    requesting_as_admin = str(row_data.sitemember_id) == ADMIN_OVERRIDE_UUID

    # 2. Check if the ROW ITSELF belongs to the Admin
    row_owned_by_admin = str(row_to_update.sitemember_id) == ADMIN_OVERRIDE_UUID

    if not requesting_as_admin:
        # If the row belongs to the Admin, we allow the update (Public Booking Scenario)
        if row_owned_by_admin:
            pass 
        # Otherwise, enforce strict ownership (User A cannot edit User B's data)
        elif row_to_update.sitemember_id is not None:
            if str(row_to_update.sitemember_id) != str(row_data.sitemember_id):
                raise HTTPException(status_code=403, detail="Permission denied: Incorrect owner ID.")
    
    # --- END OF NEW LOGIC ---

    # Logic to update the owner field...
    if not requesting_as_admin:
        # If it's a public booking on an Admin row, keep the Admin as owner? 
        # Or transfer ownership to the user?
        # Usually, for booking slots, you want the SLOT to stay Admin-owned, 
        # but the DATA inside (booked_by) to change.
        if not row_owned_by_admin:
             row_to_update.sitemember_id = row_data.sitemember_id
    
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

#region complex
class SearchQuery(BaseModel):
    filters: Dict[str, Any] = {} 
    sort_by: Optional[str] = "created_at"
    sort_order: Optional[str] = "desc" 


@router.post("/rows/{schema_id}/search", response_model=PaginatedRowResponse)
async def search_data_rows(
    schema_id: UUID,
    query: SearchQuery,
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=1000),
    sitemember_id: Optional[UUID] = Query(None),
    db: AsyncSession = Depends(get_db)
):
    schema = await db.get(CustomDataSchema, schema_id)
    if not schema:
        raise HTTPException(status_code=404, detail="Schema not found.")

    base_query = select(CustomDataRow).where(CustomDataRow.schema_id == schema_id)
    
    if sitemember_id is not None:
        base_query = base_query.where(CustomDataRow.sitemember_id == sitemember_id)

    # 1. Apply JSON Filters dynamically
    for field, condition in query.filters.items():
        # ✅ THE FIX: Revert to ->> operator to prevent .astext crashes
        json_text_value = CustomDataRow.data.op("->>")(field)
        
        if isinstance(condition, dict):
            # 🚨 ANTI-CRASH MEASURE: Ignore empty strings before doing math
            if any(op in condition for op in [">", "<", ">=", "<="]):
                base_query = base_query.where(json_text_value != "")
                base_query = base_query.where(json_text_value.is_not(None))

            # Helper to handle both Floats (prices) and Strings (dates) safely
            def apply_range_filter(query, operator_symbol, value):
                try:
                    # If it's a number, cast it so math works perfectly
                    num_val = float(value)
                    if operator_symbol == ">": return query.where(json_text_value.cast(Float) > num_val)
                    if operator_symbol == "<": return query.where(json_text_value.cast(Float) < num_val)
                    if operator_symbol == ">=": return query.where(json_text_value.cast(Float) >= num_val)
                    if operator_symbol == "<=": return query.where(json_text_value.cast(Float) <= num_val)
                except ValueError:
                    # If it fails float conversion (like "2026-02-20"), use raw string comparison!
                    if operator_symbol == ">": return query.where(json_text_value > str(value))
                    if operator_symbol == "<": return query.where(json_text_value < str(value))
                    if operator_symbol == ">=": return query.where(json_text_value >= str(value))
                    if operator_symbol == "<=": return query.where(json_text_value <= str(value))
                return query

            if ">" in condition:
                base_query = apply_range_filter(base_query, ">", condition[">"])
            if "<" in condition:
                base_query = apply_range_filter(base_query, "<", condition["<"])
            if ">=" in condition:
                base_query = apply_range_filter(base_query, ">=", condition[">="])
            if "<=" in condition:
                base_query = apply_range_filter(base_query, "<=", condition["<="])
                
            if "ilike" in condition: 
                # ✅ THE ILIKE FIX: Use .op("ilike")
                base_query = base_query.where(json_text_value.op("ilike")(f"%{condition['ilike']}%"))
        else:
            # ✅ BOOLEAN SAFETY: Convert Python True/False to JSON "true"/"false"
            if isinstance(condition, bool):
                base_query = base_query.where(json_text_value == str(condition).lower())
            else:
                base_query = base_query.where(json_text_value == str(condition))

    # Calculate the total count HERE, before sorting is applied!
    count_query = select(func.count(CustomDataRow.row_id)).select_from(base_query.subquery())
    total_result = await db.execute(count_query)
    total_rows = total_result.scalar_one()

    # 2. Apply Sorting
    if query.sort_by == "created_at":
        if query.sort_order == "desc":
            base_query = base_query.order_by(CustomDataRow.created_at.desc())
        else:
            base_query = base_query.order_by(CustomDataRow.created_at.asc())
    else:
        # ✅ THE SORTING FIX: Revert to ->> for sorting too!
        if query.sort_order == "desc":
            base_query = base_query.order_by(CustomDataRow.data.op("->>")(query.sort_by).desc())
        else:
            base_query = base_query.order_by(CustomDataRow.data.op("->>")(query.sort_by).asc())
            
    # 3. Apply pagination and fetch rows
    paginated_query = base_query.offset(skip).limit(limit)
    result = await db.execute(paginated_query)
    rows = result.scalars().all()

    # 4. Resolve relations
    relation_fields = {
        field['id']: UUID(field['related_schema_id'])
        for field in schema.fields
        if field.get('type') == 'relation' and field.get('related_schema_id')
    }

    if not relation_fields:
        return PaginatedRowResponse(
            rows=[RowResponse.from_orm(row) for row in rows],
            total=total_rows
        )

    ids_to_fetch = set()
    for row in rows:
        for field_id in relation_fields:
            related_row_id = row.data.get(field_id)
            if related_row_id:
                try:
                    ids_to_fetch.add(UUID(related_row_id))
                except (ValueError, TypeError):
                    pass 

    if not ids_to_fetch:
        return PaginatedRowResponse(
            rows=[RowResponse.from_orm(row) for row in rows],
            total=total_rows
        )

    related_rows_result = await db.execute(
        select(CustomDataRow).where(CustomDataRow.row_id.in_(ids_to_fetch))
    )
    related_rows_map = { 
        str(row.row_id): RowResponse.from_orm(row).model_dump() 
        for row in related_rows_result.scalars() 
    }

    final_response_rows = []
    for row in rows:
        resolved_data = row.data.copy()
        for field_id in relation_fields:
            related_row_id = resolved_data.get(field_id)
            if related_row_id and str(related_row_id) in related_rows_map:
                resolved_data[field_id] = related_rows_map[str(related_row_id)]
        
        final_response_rows.append(RowResponse(row_id=row.row_id, data=resolved_data))

    return PaginatedRowResponse(rows=final_response_rows, total=total_rows)
#endregion complex

#region ai_sitemember_use
class MemberUsageResponse(BaseModel):
    website_id: UUID
    member_id: str
    limit_usd: float
    used_usd: float
    remaining_usd: float
    total_calls: int

@router.get("/usage/{website_id}/{member_id}", response_model=MemberUsageResponse)
async def get_site_member_usage(
    website_id: UUID,
    member_id: str, # ✅ Changed to string to prevent 422 CORS crashes
    db: AsyncSession = Depends(get_db)
):
    """Fetches the AI usage for a specific user on a specific website."""
    
    # 1. Safely parse the UUID
    try:
        mem_uuid = UUID(member_id)
    except ValueError:
        # If the frontend sends "null", return 0 safely instead of crashing
        return MemberUsageResponse(
            website_id=website_id, member_id=member_id, limit_usd=0.0, used_usd=0.0, remaining_usd=0.0, total_calls=0
        )

    # 2. Get the Website to find the global limit
    website = await db.get(Website, website_id)
    if not website:
        raise HTTPException(status_code=404, detail="Website not found")
    
    raw_limit = getattr(website, 'member_ai_spend_limit_usd', 0.10)
    limit_usd = float(raw_limit) if raw_limit is not None else 0.10
        
    # 3. Get the Member's specific usage
    result = await db.execute(
        select(SiteMemberUsage).where(
            SiteMemberUsage.website_id == website_id,
            SiteMemberUsage.member_id == mem_uuid
        )
    )
    usage = result.scalars().first()
    
    used_usd = float(usage.ai_spend_usd) if usage and usage.ai_spend_usd is not None else 0.0
    total_calls = usage.ai_calls_count if usage else 0
    remaining_usd = max(0.0, limit_usd - used_usd)
    
    return MemberUsageResponse(
        website_id=website_id,
        member_id=member_id,
        limit_usd=limit_usd,
        used_usd=used_usd,
        remaining_usd=remaining_usd,
        total_calls=total_calls
    )
#endregion ai_sitemember_use


#region bulk
class BulkRowOperation(BaseModel):
    action: Literal["create", "update", "delete"]
    row_id: Optional[UUID] = None        # required for update + delete
    data: Optional[Dict[str, Any]] = None  # required for create + update
    sitemember_id: Optional[UUID] = None

class BulkRowRequest(BaseModel):
    operations: List[BulkRowOperation]

class BulkRowResult(BaseModel):
    action: str
    row_id: Optional[str] = None
    status: str                          # "success" or "error"
    error: Optional[str] = None

class BulkRowResponse(BaseModel):
    results: List[BulkRowResult]
    total: int
    succeeded: int
    failed: int
    
@router.post("/rows/{schema_id}/bulk", response_model=BulkRowResponse)
async def bulk_row_operations(
    schema_id: UUID,
    body: BulkRowRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    Perform multiple create / update / delete operations in one request.
    Uses nested transactions (savepoints) so one failure doesn't crash the others.
    """
    schema = await db.get(CustomDataSchema, schema_id)
    if not schema:
        raise HTTPException(status_code=404, detail="Schema not found.")

    results: List[BulkRowResult] = []
    ADMIN_UUID = "00000000-0000-0000-0000-000000000000"

    for op in body.operations:
        try:
            # ✅ CRITICAL FIX: Use a Savepoint. If an error happens inside this block, 
            # it only rolls back THIS specific row, keeping the rest of the batch safe!
            async with db.begin_nested():
                
                # ── CREATE ──────────────────────────────────────────────
                if op.action == "create":
                    if op.data is None:
                        raise ValueError("'data' is required for create.")
                    
                    new_row = CustomDataRow(
                        schema_id=schema_id,
                        data=op.data,
                        sitemember_id=op.sitemember_id
                    )
                    db.add(new_row)
                    await db.flush()  # Safe to do now because of begin_nested()
                    
                    results.append(BulkRowResult(
                        action="create", row_id=str(new_row.row_id), status="success"
                    ))

                # ── UPDATE ──────────────────────────────────────────────
                elif op.action == "update":
                    if op.row_id is None: raise ValueError("'row_id' is required for update.")
                    if op.data is None: raise ValueError("'data' is required for update.")

                    row = await db.get(CustomDataRow, op.row_id)
                    if not row: raise ValueError(f"Row {op.row_id} not found.")

                    requesting_as_admin = str(op.sitemember_id) == ADMIN_UUID
                    row_owned_by_admin  = str(row.sitemember_id) == ADMIN_UUID

                    if not requesting_as_admin:
                        if not row_owned_by_admin:
                            if row.sitemember_id is not None and str(row.sitemember_id) != str(op.sitemember_id):
                                raise ValueError("Permission denied: incorrect owner ID.")

                    # ✅ CRITICAL FIX: Direct overwrite to match your PUT endpoint 
                    row.data = op.data

                    if not requesting_as_admin and not row_owned_by_admin:
                        row.sitemember_id = op.sitemember_id

                    results.append(BulkRowResult(
                        action="update", row_id=str(op.row_id), status="success"
                    ))

                # ── DELETE ──────────────────────────────────────────────
                elif op.action == "delete":
                    if op.row_id is None: raise ValueError("'row_id' is required for delete.")

                    row = await db.get(CustomDataRow, op.row_id)
                    if not row:
                        results.append(BulkRowResult(
                            action="delete", row_id=str(op.row_id), status="success"
                        ))
                        continue # Skip the rest of the loop for this row

                    if row.sitemember_id is not None:
                        if op.sitemember_id is None or (str(row.sitemember_id) != str(op.sitemember_id) and str(op.sitemember_id) != ADMIN_UUID):
                            raise ValueError("Permission denied to delete this row.")

                    await db.delete(row)
                    
                    results.append(BulkRowResult(
                        action="delete", row_id=str(op.row_id), status="success"
                    ))

                else:
                    raise ValueError(f"Unknown action '{op.action}'.")

        except Exception as e:
            # If an error happens, the savepoint automatically rolls back JUST this operation!
            results.append(BulkRowResult(
                action=op.action,
                row_id=str(op.row_id) if op.row_id else None,
                status="error",
                error=str(e)
            ))

    # Commit everything that succeeded in one shot
    await db.commit()

    return BulkRowResponse(
        results=results,
        total=len(results),
        succeeded=sum(1 for r in results if r.status == "success"),
        failed=sum(1 for r in results if r.status == "error")
    )

#endregion bulk

#region Aggregate Stats


class StatQuery(BaseModel):
    field: str
    operation: Literal["sum", "avg", "min", "max", "count"]
    filters: Dict[str, Any] = {} 
    
class StatResponse(BaseModel):
    operation: str
    field: str
    result: float

# ============================================================
# ADD THIS ENDPOINT to your custom_data router
# ============================================================
@router.post("/rows/{schema_id}/stats", response_model=StatResponse)
async def get_aggregate_stats(
    schema_id: UUID,
    query: StatQuery,
    sitemember_id: Optional[UUID] = Query(None),
    db: AsyncSession = Depends(get_db)
):
    """
    Calculates sum, avg, min, max, or count for a specific JSON field directly in the database.
    Supports the exact same dynamic filters as the search endpoint.
    """
    schema = await db.get(CustomDataSchema, schema_id)
    if not schema:
        raise HTTPException(status_code=404, detail="Schema not found.")

    base_query = select(CustomDataRow).where(CustomDataRow.schema_id == schema_id)
    
    if sitemember_id is not None:
        base_query = base_query.where(CustomDataRow.sitemember_id == sitemember_id)

    # 1. Apply the same JSON Filters dynamically (Re-used from your search endpoint)
    for filter_field, condition in query.filters.items():
        json_text_value = CustomDataRow.data.op("->>")(filter_field)
        
        if isinstance(condition, dict):
            if any(op in condition for op in [">", "<", ">=", "<="]):
                base_query = base_query.where(json_text_value != "")
                base_query = base_query.where(json_text_value.is_not(None))

            def apply_range_filter(q, operator_symbol, value):
                try:
                    num_val = float(value)
                    if operator_symbol == ">": return q.where(json_text_value.cast(Float) > num_val)
                    if operator_symbol == "<": return q.where(json_text_value.cast(Float) < num_val)
                    if operator_symbol == ">=": return q.where(json_text_value.cast(Float) >= num_val)
                    if operator_symbol == "<=": return q.where(json_text_value.cast(Float) <= num_val)
                except ValueError:
                    if operator_symbol == ">": return q.where(json_text_value > str(value))
                    if operator_symbol == "<": return q.where(json_text_value < str(value))
                    if operator_symbol == ">=": return q.where(json_text_value >= str(value))
                    if operator_symbol == "<=": return q.where(json_text_value <= str(value))
                return q

            if ">" in condition: base_query = apply_range_filter(base_query, ">", condition[">"])
            if "<" in condition: base_query = apply_range_filter(base_query, "<", condition["<"])
            if ">=" in condition: base_query = apply_range_filter(base_query, ">=", condition[">="])
            if "<=" in condition: base_query = apply_range_filter(base_query, "<=", condition["<="])
            if "ilike" in condition: base_query = base_query.where(json_text_value.op("ilike")(f"%{condition['ilike']}%"))
        else:
            if isinstance(condition, bool):
                base_query = base_query.where(json_text_value == str(condition).lower())
            else:
                base_query = base_query.where(json_text_value == str(condition))

    # 2. Setup the Aggregate Math Operation
    target_field_text = CustomDataRow.data.op("->>")(query.field)
    
    # We must cast the JSON text to a Float for math to work!
    # Also, we ignore empty strings or nulls so they don't crash the math.
    safe_target_field = target_field_text.cast(Float)
    
    if query.operation == "count":
        agg_func = func.count(CustomDataRow.row_id)
    elif query.operation == "sum":
        agg_func = func.sum(safe_target_field)
    elif query.operation == "avg":
        agg_func = func.avg(safe_target_field)
    elif query.operation == "max":
        agg_func = func.max(safe_target_field)
    elif query.operation == "min":
        agg_func = func.min(safe_target_field)
    else:
        raise HTTPException(status_code=400, detail="Invalid operation.")

    # Apply the math ONLY to rows where the target field actually exists and is a valid number
    if query.operation != "count":
         # Regex to ensure it's a valid number format before casting
         base_query = base_query.where(target_field_text.op('~')('^[0-9]+(\.[0-9]+)?$'))

    # 3. Execute the math query
    final_query = select(agg_func).select_from(base_query.subquery())
    result = await db.execute(final_query)
    calculated_value = result.scalar()

    # Handle cases where the sum/avg is empty (returns None)
    if calculated_value is None:
        calculated_value = 0.0

    return StatResponse(
        operation=query.operation,
        field=query.field,
        result=float(calculated_value)
    )