# backend/websitebuilder/custom_data_router.py
from fastapi import APIRouter, Depends, HTTPException,Query
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, Float, desc, literal_column
import httpx
from fastapi.security import OAuth2PasswordBearer
from models import SchemaAutomation
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
    related_schema_id: Optional[UUID] = None
    # --- server-enforced validation (all optional, backward compatible) ---
    required: bool = False
    unique: bool = False
    default: Optional[Any] = None
    min: Optional[float] = None
    max: Optional[float] = None
    options: Optional[List[str]] = None   # enum → dropdowns become data-driven

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
    sitemember_id: Optional[UUID] = None # 👈 ADD THIS LINE
    data: Dict[str, Any] # This will now contain resolved nested data
    
    class Config: from_attributes = True
    
class PaginatedRowResponse(BaseModel):
    rows: List[RowResponse]
    total: int


# ============================================================
# PASTE THIS ENTIRE BLOCK AT THE BOTTOM OF
# backend/websitebuilder/custom_data_router.py
# (after "#endregion Aggregate Stats")
#
# Requires the imports from PATCH 1 in 3_custom_data_patches.md.
# ============================================================

#region security_helpers

ADMIN_UUID = "00000000-0000-0000-0000-000000000000"

# The builder frontend (`api` axios client) sends the auth token;
# the public runtime (`saasApi`) does not. So this dependency yields
# the logged-in owner in the builder and None on public sites —
# which is exactly what lets us secure the admin override.
oauth2_optional = OAuth2PasswordBearer(tokenUrl="auth/token", auto_error=False)
# ⚠️ ADAPT: set tokenUrl to your real login route (same one your
#    existing OAuth2PasswordBearer in auth_handler.py uses).


async def get_optional_user(
    token: Optional[str] = Depends(oauth2_optional),
    db: AsyncSession = Depends(get_db),
) -> Optional[User]:
    if not token:
        return None
    try:
        import jwt as pyjwt
        from auth.auth_handler import SECRET_KEY, ALGORITHM  # adapt names if different
        payload = pyjwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        identifier = payload.get("sub")
        if not identifier:
            return None
        result = await db.execute(select(User).where(User.email == identifier))
        return result.scalars().first()
    except Exception:
        return None


async def verify_admin_override(website_id: UUID, user: Optional[User], db: AsyncSession):
    """Claiming ADMIN_UUID now requires being the authenticated website owner."""
    if user is None:
        raise HTTPException(status_code=403, detail="Admin override requires owner authentication.")
    await get_website_and_check_ownership(website_id, user, db)

#endregion security_helpers


#region shared_helpers

def apply_json_filters(base_query, filters: Dict[str, Any]):
    """The exact filter semantics of /search, reusable everywhere."""
    for field, condition in filters.items():
        col = CustomDataRow.data.op("->>")(field)
        if isinstance(condition, dict):
            if any(op in condition for op in [">", "<", ">=", "<="]):
                base_query = base_query.where(col != "").where(col.is_not(None))
            for sym in [">", "<", ">=", "<="]:
                if sym not in condition:
                    continue
                v = condition[sym]
                try:
                    num = float(v)
                    expr = col.cast(Float)
                    if sym == ">":
                        base_query = base_query.where(expr > num)
                    elif sym == "<":
                        base_query = base_query.where(expr < num)
                    elif sym == ">=":
                        base_query = base_query.where(expr >= num)
                    else:
                        base_query = base_query.where(expr <= num)
                except (ValueError, TypeError):
                    if sym == ">":
                        base_query = base_query.where(col > str(v))
                    elif sym == "<":
                        base_query = base_query.where(col < str(v))
                    elif sym == ">=":
                        base_query = base_query.where(col >= str(v))
                    else:
                        base_query = base_query.where(col <= str(v))
            if "ilike" in condition:
                base_query = base_query.where(col.op("ilike")(f"%{condition['ilike']}%"))
        else:
            if isinstance(condition, bool):
                base_query = base_query.where(col == str(condition).lower())
            else:
                base_query = base_query.where(col == str(condition))
    return base_query


def apply_field_defaults(schema: CustomDataSchema, data: Dict[str, Any]) -> Dict[str, Any]:
    out = dict(data)
    for f in (schema.fields or []):
        if f.get("default") is not None and out.get(f["id"]) in (None, ""):
            out[f["id"]] = f["default"]
    return out


def validate_row_data(schema: CustomDataSchema, data: Dict[str, Any], partial: bool = False):
    """Enforces required / number bounds / options. Raises 422 with a readable message."""
    errors = []
    for f in (schema.fields or []):
        fid = f["id"]
        label = f.get("label", fid)
        val = data.get(fid)

        if f.get("required") and not partial and val in (None, ""):
            errors.append(f"'{label}' is required")
            continue
        if val in (None, ""):
            continue

        if f.get("type") == "number":
            try:
                num = float(val)
                if f.get("min") is not None and num < float(f["min"]):
                    errors.append(f"'{label}' must be at least {f['min']}")
                if f.get("max") is not None and num > float(f["max"]):
                    errors.append(f"'{label}' must be at most {f['max']}")
            except (ValueError, TypeError):
                errors.append(f"'{label}' must be a number")

        opts = f.get("options")
        if opts and str(val) not in [str(o) for o in opts]:
            errors.append(f"'{label}' must be one of: {', '.join(map(str, opts))}")

    if errors:
        raise HTTPException(status_code=422, detail="; ".join(errors))


async def check_unique_fields(
    schema: CustomDataSchema,
    schema_id: UUID,
    data: Dict[str, Any],
    db: AsyncSession,
    exclude_row_id: Optional[UUID] = None,
):
    """Raises 409 if a field marked unique already holds this value in another row."""
    for f in (schema.fields or []):
        if not f.get("unique"):
            continue
        val = data.get(f["id"])
        if val in (None, ""):
            continue
        q = select(CustomDataRow.row_id).where(
            CustomDataRow.schema_id == schema_id,
            CustomDataRow.data.op("->>")(f["id"]) == str(val),
        )
        if exclude_row_id is not None:
            q = q.where(CustomDataRow.row_id != exclude_row_id)
        existing = (await db.execute(q.limit(1))).scalar()
        if existing:
            raise HTTPException(
                status_code=409,
                detail=f"'{f.get('label', f['id'])}' must be unique — '{val}' already exists.",
            )

#endregion shared_helpers


#region automations

async def run_automations(
    db: AsyncSession,
    schema_id: UUID,
    trigger: str,
    row_data: Dict[str, Any],
    sitemember_id,
):
    """
    Executes SchemaAutomation rules inside the caller's transaction.
    mutate_row uses SELECT ... FOR UPDATE — race-safe. A failed
    'conditions' check raises 409 and aborts the write that triggered it
    (that's the double-booking rejection).
    """
    result = await db.execute(
        select(SchemaAutomation).where(
            SchemaAutomation.schema_id == schema_id,
            SchemaAutomation.trigger == trigger,
            SchemaAutomation.enabled == True,  # noqa: E712
        )
    )
    for auto in result.scalars().all():
        cfg = auto.config or {}

        if auto.action_type == "mutate_row":
            target_id = row_data.get(cfg.get("source_field", ""))
            if isinstance(target_id, dict):  # resolved relation object
                target_id = target_id.get("row_id")
            if not target_id:
                continue
            try:
                target_uuid = UUID(str(target_id))
            except (ValueError, TypeError):
                continue

            locked = await db.execute(
                select(CustomDataRow)
                .where(CustomDataRow.row_id == target_uuid)
                .with_for_update()
            )
            target = locked.scalars().first()
            if not target:
                continue

            for k, v in (cfg.get("conditions") or {}).items():
                if str(target.data.get(k)).lower() != str(v).lower():
                    raise HTTPException(
                        status_code=409,
                        detail=cfg.get(
                            "condition_error",
                            f"Automation blocked: '{k}' condition failed (already taken?).",
                        ),
                    )

            new_data = dict(target.data)
            for k, delta in (cfg.get("increments") or {}).items():
                try:
                    new_data[k] = float(new_data.get(k) or 0) + float(delta)
                except (ValueError, TypeError):
                    pass
            new_data.update(cfg.get("set") or {})
            target.data = new_data

        elif auto.action_type == "webhook":
            url = cfg.get("url")
            if url:
                try:
                    async with httpx.AsyncClient(timeout=5) as c:
                        await c.post(url, json={"trigger": trigger, "data": row_data})
                except Exception as e:
                    print(f"[automation webhook] failed: {e}")  # never block the write

        elif auto.action_type == "send_email":
            # Optional: wire this to your /builder/send-email logic.
            # cfg keys suggestion: to_field (data field with the email),
            # subject, content.
            pass


class AutomationCreate(BaseModel):
    schema_id: UUID
    trigger: Literal["on_create", "on_update", "on_delete"]
    action_type: Literal["mutate_row", "webhook", "send_email"]
    config: Dict[str, Any] = {}
    enabled: bool = True


class AutomationResponse(BaseModel):
    id: UUID
    schema_id: UUID
    trigger: str
    action_type: str
    config: Dict[str, Any]
    enabled: bool

    class Config:
        from_attributes = True


@router.post("/automations", response_model=AutomationResponse, status_code=201)
async def create_automation(
    body: AutomationCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    schema = await db.get(CustomDataSchema, body.schema_id)
    if not schema:
        raise HTTPException(status_code=404, detail="Schema not found.")
    await get_website_and_check_ownership(schema.website_id, current_user, db)
    auto = SchemaAutomation(**body.model_dump())
    db.add(auto)
    await db.commit()
    await db.refresh(auto)
    return auto


@router.get("/automations/schema/{schema_id}", response_model=List[AutomationResponse])
async def list_automations(
    schema_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    schema = await get_schema_and_check_ownership(schema_id, current_user, db)
    result = await db.execute(
        select(SchemaAutomation).where(SchemaAutomation.schema_id == schema.schema_id)
    )
    return result.scalars().all()


@router.delete("/automations/{automation_id}", status_code=204)
async def delete_automation(
    automation_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    auto = await db.get(SchemaAutomation, automation_id)
    if not auto:
        return None
    schema = await db.get(CustomDataSchema, auto.schema_id)
    await get_website_and_check_ownership(schema.website_id, current_user, db)
    await db.delete(auto)
    await db.commit()
    return None

#endregion automations


#region atomic

class AtomicUpdate(BaseModel):
    increments: Dict[str, float] = {}   # {"credits": -1, "views": 1}
    set_values: Dict[str, Any] = {}     # {"available": False, "booked_by": "John"}
    conditions: Dict[str, Any] = {}     # only apply if these match → else 409
    sitemember_id: Optional[UUID] = None


@router.post("/rows/{row_id}/atomic")
async def atomic_update_row(
    row_id: UUID,
    body: AtomicUpdate,
    db: AsyncSession = Depends(get_db),
    user: Optional[User] = Depends(get_optional_user),
):
    """
    Lock the row, check conditions, apply increments + sets, commit.
    Kills the fetch→check→PUT race (double bookings, negative stock).
    409 = "someone beat you to it".
    """
    locked = await db.execute(
        select(CustomDataRow).where(CustomDataRow.row_id == row_id).with_for_update()
    )
    row = locked.scalars().first()
    if not row:
        raise HTTPException(status_code=404, detail="Row not found.")

    requesting_as_admin = str(body.sitemember_id) == ADMIN_UUID
    row_owned_by_admin = str(row.sitemember_id) == ADMIN_UUID
    if requesting_as_admin:
        schema = await db.get(CustomDataSchema, row.schema_id)
        await verify_admin_override(schema.website_id, user, db)
    elif row.sitemember_id is not None and not row_owned_by_admin:
        if str(row.sitemember_id) != str(body.sitemember_id):
            raise HTTPException(status_code=403, detail="Permission denied.")

    for k, v in body.conditions.items():
        actual = row.data.get(k)
        if str(actual).lower() != str(v).lower():
            raise HTTPException(
                status_code=409,
                detail=f"Condition failed: '{k}' is '{actual}', expected '{v}'.",
            )

    new_data = dict(row.data)
    for k, delta in body.increments.items():
        try:
            new_data[k] = float(new_data.get(k) or 0) + float(delta)
        except (ValueError, TypeError):
            raise HTTPException(status_code=422, detail=f"Field '{k}' is not numeric.")
    new_data.update(body.set_values)

    row.data = new_data
    await db.commit()
    return {"status": "success", "row_id": str(row_id), "data": new_data}

#endregion atomic


#region upsert

class UpsertRequest(BaseModel):
    match: Dict[str, Any]               # {"sitemember_id": "..."} or {"email": "..."}
    data: Dict[str, Any]
    sitemember_id: Optional[UUID] = None


@router.post("/rows/{schema_id}/upsert", response_model=RowResponse)
async def upsert_row(
    schema_id: UUID,
    body: UpsertRequest,
    db: AsyncSession = Depends(get_db),
):
    """One call = create-or-update. Replaces the 50-line client PROFILE pattern."""
    schema = await db.get(CustomDataSchema, schema_id)
    if not schema:
        raise HTTPException(status_code=404, detail="Schema not found.")

    q = select(CustomDataRow).where(CustomDataRow.schema_id == schema_id)
    for k, v in body.match.items():
        if k == "sitemember_id":
            try:
                q = q.where(CustomDataRow.sitemember_id == UUID(str(v)))
            except (ValueError, TypeError):
                raise HTTPException(status_code=422, detail="Invalid sitemember_id in match.")
        else:
            q = q.where(CustomDataRow.data.op("->>")(k) == str(v))

    existing = (await db.execute(q.limit(1))).scalars().first()

    if existing:
        merged = {**existing.data, **body.data}
        validate_row_data(schema, merged, partial=True)
        await check_unique_fields(schema, schema_id, body.data, db, exclude_row_id=existing.row_id)
        existing.data = merged
        await db.commit()
        await db.refresh(existing)
        return existing

    data = apply_field_defaults(schema, body.data)
    validate_row_data(schema, data)
    await check_unique_fields(schema, schema_id, data, db)
    new_row = CustomDataRow(schema_id=schema_id, data=data, sitemember_id=body.sitemember_id)
    db.add(new_row)
    await db.commit()
    await db.refresh(new_row)
    return new_row

#endregion upsert


#region grouped_stats

class GroupStatQuery(BaseModel):
    group_by: str                        # field to group on (e.g. "category")
    field: Optional[str] = None          # field to aggregate (None for count)
    operation: Literal["sum", "avg", "min", "max", "count"] = "count"
    filters: Dict[str, Any] = {}
    limit: int = 50


@router.post("/rows/{schema_id}/stats/grouped")
async def grouped_stats(
    schema_id: UUID,
    q: GroupStatQuery,
    sitemember_id: Optional[UUID] = Query(None),
    db: AsyncSession = Depends(get_db),
):
    """
    Chart data in one query: "sales by category", "bookings per day",
    "top products". No more fetching all rows to aggregate in JS.
    Returns {"results": [{"group": ..., "value": ...}]} sorted by value desc.
    """
    schema = await db.get(CustomDataSchema, schema_id)
    if not schema:
        raise HTTPException(status_code=404, detail="Schema not found.")

    base = select(CustomDataRow).where(CustomDataRow.schema_id == schema_id)
    if sitemember_id is not None:
        base = base.where(CustomDataRow.sitemember_id == sitemember_id)
    base = apply_json_filters(base, q.filters)

    sub = base.subquery()  # sub.c only — avoids the cross-join multiplication trap
    group_col = sub.c.data.op("->>")(q.group_by)

    if q.operation == "count":
        agg = func.count(sub.c.row_id).label("val")
        query = select(group_col.label("grp"), agg).select_from(sub)
    else:
        if not q.field:
            raise HTTPException(status_code=422, detail="'field' is required for non-count operations.")
        val_text = sub.c.data.op("->>")(q.field)
        ops = {"sum": func.sum, "avg": func.avg, "min": func.min, "max": func.max}
        agg = ops[q.operation](val_text.cast(Float)).label("val")
        query = (
            select(group_col.label("grp"), agg)
            .select_from(sub)
            .where(val_text.op("~")(r"^-?[0-9]+(\.[0-9]+)?$"))  # numeric-only guard
        )

    query = (
        query.where(group_col.is_not(None))
        .group_by(group_col)
        .order_by(desc(literal_column("val")))
        .limit(q.limit)
    )
    rows = (await db.execute(query)).all()
    return {
        "operation": q.operation,
        "results": [
            {"group": r.grp, "value": float(r.val) if r.val is not None else 0.0}
            for r in rows
        ],
    }

#endregion grouped_stats


#region distinct

@router.get("/rows/{schema_id}/distinct/{field}")
async def distinct_values(
    schema_id: UUID,
    field: str,
    limit: int = Query(100, ge=1, le=500),
    db: AsyncSession = Depends(get_db),
):
    """Unique values of a field. Replaces the client-side `new Set()` dedup dance."""
    col = CustomDataRow.data.op("->>")(field)
    q = (
        select(col)
        .where(CustomDataRow.schema_id == schema_id)
        .where(col.is_not(None))
        .where(col != "")
        .distinct()
        .limit(limit)
    )
    vals = (await db.execute(q)).scalars().all()
    return {"field": field, "values": vals}

#endregion distinct
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
        
        final_response_rows.append(
            RowResponse(row_id=row.row_id, sitemember_id=row.sitemember_id, data=resolved_data)
        )

    return PaginatedRowResponse(rows=final_response_rows, total=total_rows)





# --- SITE MEMBER Endpoints (No changes needed below) ---

@router.post("/rows/{schema_id}", status_code=201)
async def add_data_row(
    schema_id: UUID,
    row_data: RowCreate,
    db: AsyncSession = Depends(get_db)
):
    schema = await db.get(CustomDataSchema, schema_id)
    if not schema:
        raise HTTPException(status_code=404, detail="Schema not found.")

    data = apply_field_defaults(schema, row_data.data)
    validate_row_data(schema, data)                       # 422 with readable message
    await check_unique_fields(schema, schema_id, data, db)  # 409 on duplicates

    # Server-side automations run in the SAME transaction:
    # a failed booking condition raises 409 and the insert never happens.
    await run_automations(db, schema_id, "on_create", data, row_data.sitemember_id)

    new_row = CustomDataRow(
        schema_id=schema_id,
        data=data,
        sitemember_id=row_data.sitemember_id
    )
    db.add(new_row)
    await db.flush()
    new_row_id = str(new_row.row_id)
    await db.commit()
    return {"status": "success", "row_id": new_row_id}

@router.put("/rows/{row_id}", response_model=RowResponse)
async def update_data_row(
    row_id: UUID,
    row_data: RowUpdate,
    db: AsyncSession = Depends(get_db),
    user: Optional[User] = Depends(get_optional_user),
):
    row_to_update = await db.get(CustomDataRow, row_id)
    if not row_to_update:
        raise HTTPException(status_code=404, detail="Row not found.")

    schema = await db.get(CustomDataSchema, row_to_update.schema_id)

    requesting_as_admin = str(row_data.sitemember_id) == ADMIN_UUID
    row_owned_by_admin = str(row_to_update.sitemember_id) == ADMIN_UUID

    if requesting_as_admin:
        # 🔒 SECURITY FIX: the admin UUID now requires being logged in
        # as the actual website owner. Anonymous spoofing → 403.
        await verify_admin_override(schema.website_id, user, db)
    else:
        if row_owned_by_admin:
            pass  # public booking on an admin-owned row is still allowed
        elif row_to_update.sitemember_id is not None:
            if str(row_to_update.sitemember_id) != str(row_data.sitemember_id):
                raise HTTPException(status_code=403, detail="Permission denied: Incorrect owner ID.")

    if schema:
        validate_row_data(schema, row_data.data, partial=True)
        await check_unique_fields(
            schema, row_to_update.schema_id, row_data.data, db, exclude_row_id=row_id
        )
        await run_automations(
            db, row_to_update.schema_id, "on_update", row_data.data, row_data.sitemember_id
        )

    if not requesting_as_admin and not row_owned_by_admin:
        row_to_update.sitemember_id = row_data.sitemember_id

    row_to_update.data = row_data.data
    await db.commit()
    await db.refresh(row_to_update)
    return row_to_update

@router.delete("/rows/{row_id}", status_code=204)
async def delete_data_row(
    row_id: UUID,
    sitemember_id: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    user: Optional[User] = Depends(get_optional_user),
):
    row_to_delete = await db.get(CustomDataRow, row_id)
    if not row_to_delete:
        return None

    if sitemember_id == ADMIN_UUID:
        schema = await db.get(CustomDataSchema, row_to_delete.schema_id)
        await verify_admin_override(schema.website_id, user, db)
    elif row_to_delete.sitemember_id is not None:
        member_id_or_none: Optional[UUID] = None
        if sitemember_id and sitemember_id != "null":
            try:
                member_id_or_none = UUID(sitemember_id)
            except ValueError:
                raise HTTPException(status_code=400, detail="Invalid sitemember_id format.")
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
        
        final_response_rows.append(
            RowResponse(row_id=row.row_id, sitemember_id=row.sitemember_id, data=resolved_data)
        )

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
    db: AsyncSession = Depends(get_db),
    user: Optional[User] = Depends(get_optional_user),
):
    """
    Perform multiple create / update / delete operations in one request.
    Uses nested transactions (savepoints) so one failure doesn't crash the others.
    """
    schema = await db.get(CustomDataSchema, schema_id)
    if not schema:
        raise HTTPException(status_code=404, detail="Schema not found.")

    results: List[BulkRowResult] = []
    admin_verified = False

    for op in body.operations:
        try:
            # ✅ CRITICAL FIX: Use a Savepoint. If an error happens inside this block, 
            # it only rolls back THIS specific row, keeping the rest of the batch safe!
            async with db.begin_nested():
                
                # ── CREATE ──────────────────────────────────────────────
                if op.action == "create":
                    if op.data is None:
                        raise ValueError("'data' is required for create.")
                    
                    op_data = apply_field_defaults(schema, op.data)
                    validate_row_data(schema, op_data)
                    await check_unique_fields(schema, schema_id, op_data, db)
                    await run_automations(db, schema_id, "on_create", op_data, op.sitemember_id)

                    new_row = CustomDataRow(
                        schema_id=schema_id,
                        data=op_data,
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
                    if requesting_as_admin and not admin_verified:
                        await verify_admin_override(schema.website_id, user, db)
                        admin_verified = True
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

                    claiming_admin = str(op.sitemember_id) == ADMIN_UUID
                    if claiming_admin and not admin_verified:
                        await verify_admin_override(schema.website_id, user, db)
                        admin_verified = True
                    if row.sitemember_id is not None and not claiming_admin:
                        if op.sitemember_id is None or str(row.sitemember_id) != str(op.sitemember_id):
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
    schema = await db.get(CustomDataSchema, schema_id)
    if not schema:
        raise HTTPException(status_code=404, detail="Schema not found.")

    # 1. Build the filtered base query
    base_query = select(CustomDataRow).where(CustomDataRow.schema_id == schema_id)

    if sitemember_id is not None:
        base_query = base_query.where(CustomDataRow.sitemember_id == sitemember_id)

    # Apply JSON filters (same logic as /search)
    for filter_field, condition in query.filters.items():
        json_text_value = CustomDataRow.data.op("->>")(filter_field)

        if isinstance(condition, dict):
            if any(op in condition for op in [">", "<", ">=", "<="]):
                base_query = base_query.where(json_text_value != "")
                base_query = base_query.where(json_text_value.is_not(None))

            def apply_range_filter(q, operator_symbol, value):
                try:
                    num_val = float(value)
                    if operator_symbol == ">":  return q.where(json_text_value.cast(Float) > num_val)
                    if operator_symbol == "<":  return q.where(json_text_value.cast(Float) < num_val)
                    if operator_symbol == ">=": return q.where(json_text_value.cast(Float) >= num_val)
                    if operator_symbol == "<=": return q.where(json_text_value.cast(Float) <= num_val)
                except ValueError:
                    if operator_symbol == ">":  return q.where(json_text_value > str(value))
                    if operator_symbol == "<":  return q.where(json_text_value < str(value))
                    if operator_symbol == ">=": return q.where(json_text_value >= str(value))
                    if operator_symbol == "<=": return q.where(json_text_value <= str(value))
                return q

            if ">" in condition:  base_query = apply_range_filter(base_query, ">",  condition[">"])
            if "<" in condition:  base_query = apply_range_filter(base_query, "<",  condition["<"])
            if ">=" in condition: base_query = apply_range_filter(base_query, ">=", condition[">="])
            if "<=" in condition: base_query = apply_range_filter(base_query, "<=", condition["<="])
            if "ilike" in condition:
                base_query = base_query.where(json_text_value.op("ilike")(f"%{condition['ilike']}%"))
        else:
            if isinstance(condition, bool):
                base_query = base_query.where(json_text_value == str(condition).lower())
            else:
                base_query = base_query.where(json_text_value == str(condition))

    # 2. Convert to subquery — ALL aggregate references must use sub.c, never CustomDataRow directly.
    #    Using CustomDataRow after .select_from(subquery) causes a silent cross join
    #    (N rows × N rows) which multiplies the result by N. sub.c avoids this entirely.
    sub = base_query.subquery()

    # Reference the target field through the subquery columns
    sub_field_text = sub.c.data.op("->>")(query.field)

    # 3. Build the aggregate function — everything from sub.c, never CustomDataRow
    if query.operation == "count":
        agg_func = func.count(sub.c.row_id)
        final_query = select(agg_func).select_from(sub)
    else:
        # Filter to numeric-only values before casting to avoid cast errors
        agg_query = select(sub).where(
            sub_field_text.op("~")(r"^-?[0-9]+(\.[0-9]+)?$")
        ).subquery()

        agg_field = agg_query.c.data.op("->>")(query.field).cast(Float)

        if query.operation == "sum":
            agg_func = func.sum(agg_field)
        elif query.operation == "avg":
            agg_func = func.avg(agg_field)
        elif query.operation == "max":
            agg_func = func.max(agg_field)
        elif query.operation == "min":
            agg_func = func.min(agg_field)
        else:
            raise HTTPException(status_code=400, detail="Invalid operation.")

        final_query = select(agg_func).select_from(agg_query)

    # 4. Execute
    result = await db.execute(final_query)
    calculated_value = result.scalar()

    if calculated_value is None:
        calculated_value = 0.0

    return StatResponse(
        operation=query.operation,
        field=query.field,
        result=float(calculated_value)
    )
    
    
    