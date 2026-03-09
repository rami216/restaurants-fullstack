"""
Zygoflow Agent Platform — FastAPI Routes
"""

import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from fastapi import APIRouter, Depends, HTTPException, Request, Header
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from typing import List, Optional
from uuid import UUID
import secrets

from database import get_db
from agents.zygo_models import (
    ZygoUser, ZygoPipeline, ZygoAgent,
    ZygoTrigger, ZygoCustomAPI, ZygoGoogleResource, ZygoRun,
    ZygoTriggerTypeEnum, ZygoRunStatusEnum
)
from agents.zygo_schemas import (
    ZygoUserCreate, ZygoUserUpdate, ZygoUserOut,
    ZygoPipelineCreate, ZygoPipelineUpdate, ZygoPipelineOut,
    ZygoAgentCreate, ZygoAgentUpdate, ZygoAgentOut,
    ZygoTriggerCreate, ZygoTriggerOut,
    ZygoCustomAPICreate, ZygoCustomAPIOut,
    ZygoGoogleResourceCreate, ZygoGoogleResourceOut,
    ZygoRunOut
)

zygo_router = APIRouter()


# ── Token Auth ─────────────────────────────────────────────

async def get_zygo_user_from_token(
    authorization: Optional[str] = Header(None),
    db: AsyncSession = Depends(get_db)
) -> ZygoUser:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid Authorization header")
    token = authorization.replace("Bearer ", "").strip()
    result = await db.execute(select(ZygoUser).where(ZygoUser.api_token == token))
    user = result.scalars().first()
    if not user:
        raise HTTPException(status_code=401, detail="Invalid API token")
    return user


# ── Helper ─────────────────────────────────────────────────

async def get_zygo_user_by_user_id(user_id: int, db: AsyncSession) -> ZygoUser:
    result = await db.execute(select(ZygoUser).where(ZygoUser.user_id == user_id))
    user = result.scalars().first()
    if not user:
        raise HTTPException(status_code=404, detail="Zygo user not found")
    return user


# ── Me ─────────────────────────────────────────────────────

@zygo_router.get("/me")
async def get_me(current_user: ZygoUser = Depends(get_zygo_user_from_token)):
    return {
        "id": str(current_user.id),
        "email": current_user.email,
        "active_model": current_user.active_model,
        "connected": True
    }


# ── Token ──────────────────────────────────────────────────

@zygo_router.get("/users/{user_id}/token")
async def get_token(user_id: int, db: AsyncSession = Depends(get_db)):
    user = await get_zygo_user_by_user_id(user_id, db)
    if not user.api_token:
        user.api_token = secrets.token_urlsafe(32)
        await db.commit()
        await db.refresh(user)
    return {"api_token": user.api_token}

@zygo_router.post("/users/{user_id}/generate-token")
async def generate_token(user_id: int, db: AsyncSession = Depends(get_db)):
    user = await get_zygo_user_by_user_id(user_id, db)
    user.api_token = secrets.token_urlsafe(32)
    await db.commit()
    await db.refresh(user)
    return {"api_token": user.api_token}


# ── Users ──────────────────────────────────────────────────

@zygo_router.get("/users/{user_id}", response_model=ZygoUserOut)
async def get_user(user_id: int, db: AsyncSession = Depends(get_db)):
    return await get_zygo_user_by_user_id(user_id, db)

@zygo_router.patch("/users/{user_id}", response_model=ZygoUserOut)
async def update_user(user_id: int, payload: ZygoUserUpdate, db: AsyncSession = Depends(get_db)):
    user = await get_zygo_user_by_user_id(user_id, db)
    for field, value in payload.dict(exclude_unset=True).items():
        setattr(user, field, value)
    await db.commit()
    await db.refresh(user)
    return user


# ── Pipelines ──────────────────────────────────────────────

@zygo_router.get("/pipelines", response_model=List[ZygoPipelineOut])
async def list_pipelines(
    current_user: ZygoUser = Depends(get_zygo_user_from_token),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(ZygoPipeline).where(ZygoPipeline.owner_id == current_user.id))
    return result.scalars().all()

@zygo_router.post("/pipelines", response_model=ZygoPipelineOut)
async def create_pipeline(
    payload: ZygoPipelineCreate,
    current_user: ZygoUser = Depends(get_zygo_user_from_token),
    db: AsyncSession = Depends(get_db)
):
    pipeline = ZygoPipeline(owner_id=current_user.id, **payload.dict())
    db.add(pipeline)
    await db.commit()
    await db.refresh(pipeline)
    return pipeline

@zygo_router.get("/pipelines/{pipeline_id}", response_model=ZygoPipelineOut)
async def get_pipeline(pipeline_id: UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(ZygoPipeline).where(ZygoPipeline.id == pipeline_id))
    pipeline = result.scalars().first()
    if not pipeline:
        raise HTTPException(status_code=404, detail="Pipeline not found")
    return pipeline

@zygo_router.patch("/pipelines/{pipeline_id}", response_model=ZygoPipelineOut)
async def update_pipeline(pipeline_id: UUID, payload: ZygoPipelineUpdate, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(ZygoPipeline).where(ZygoPipeline.id == pipeline_id))
    pipeline = result.scalars().first()
    if not pipeline:
        raise HTTPException(status_code=404, detail="Pipeline not found")
    for field, value in payload.dict(exclude_unset=True).items():
        setattr(pipeline, field, value)
    await db.commit()
    await db.refresh(pipeline)
    return pipeline

@zygo_router.delete("/pipelines/{pipeline_id}")
async def delete_pipeline(pipeline_id: UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(ZygoPipeline).where(ZygoPipeline.id == pipeline_id))
    pipeline = result.scalars().first()
    if not pipeline:
        raise HTTPException(status_code=404, detail="Pipeline not found")
    await db.delete(pipeline)
    await db.commit()
    return {"ok": True}


# ── Agents ─────────────────────────────────────────────────

@zygo_router.get("/pipelines/{pipeline_id}/agents", response_model=List[ZygoAgentOut])
async def list_agents(pipeline_id: UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(ZygoAgent)
        .where(ZygoAgent.pipeline_id == pipeline_id)
        .order_by(ZygoAgent.order_index)
    )
    return result.scalars().all()

@zygo_router.post("/pipelines/{pipeline_id}/agents", response_model=ZygoAgentOut)
async def create_agent(pipeline_id: UUID, payload: ZygoAgentCreate, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(ZygoPipeline).where(ZygoPipeline.id == pipeline_id))
    pipeline = result.scalars().first()
    if not pipeline:
        raise HTTPException(status_code=404, detail="Pipeline not found")
    agent = ZygoAgent(pipeline_id=pipeline_id, owner_id=pipeline.owner_id, **payload.dict())
    db.add(agent)
    await db.commit()
    await db.refresh(agent)
    return agent

@zygo_router.patch("/agents/{agent_id}", response_model=ZygoAgentOut)
async def update_agent(agent_id: UUID, payload: ZygoAgentUpdate, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(ZygoAgent).where(ZygoAgent.id == agent_id))
    agent = result.scalars().first()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    for field, value in payload.dict(exclude_unset=True).items():
        setattr(agent, field, value)
    await db.commit()
    await db.refresh(agent)
    return agent

@zygo_router.delete("/agents/{agent_id}")
async def delete_agent(agent_id: UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(ZygoAgent).where(ZygoAgent.id == agent_id))
    agent = result.scalars().first()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    await db.delete(agent)
    await db.commit()
    return {"ok": True}


# ── Triggers ───────────────────────────────────────────────

@zygo_router.get("/triggers", response_model=List[ZygoTriggerOut])
async def list_triggers(
    current_user: ZygoUser = Depends(get_zygo_user_from_token),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(ZygoTrigger).where(ZygoTrigger.owner_id == current_user.id))
    return result.scalars().all()

@zygo_router.post("/triggers", response_model=ZygoTriggerOut)
async def create_trigger(
    payload: ZygoTriggerCreate,
    current_user: ZygoUser = Depends(get_zygo_user_from_token),
    db: AsyncSession = Depends(get_db)
):
    import re
    trigger = ZygoTrigger(owner_id=current_user.id, **payload.dict())
    if payload.trigger_type == ZygoTriggerTypeEnum.webhook:
        slug = re.sub(r'[^a-z0-9-]', '-', payload.name.lower().strip())
        trigger.webhook_path = f"/zygo/webhook/{slug}"
        trigger.webhook_public_url = f"https://api.zygoflow.com/zygo/webhook/{slug}"
    db.add(trigger)
    await db.commit()
    await db.refresh(trigger)
    return trigger

@zygo_router.delete("/triggers/{trigger_id}")
async def delete_trigger(trigger_id: UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(ZygoTrigger).where(ZygoTrigger.id == trigger_id))
    trigger = result.scalars().first()
    if not trigger:
        raise HTTPException(status_code=404, detail="Trigger not found")
    await db.delete(trigger)
    await db.commit()
    return {"ok": True}


# ── Custom APIs ────────────────────────────────────────────

@zygo_router.get("/apis", response_model=List[ZygoCustomAPIOut])
async def list_apis(
    current_user: ZygoUser = Depends(get_zygo_user_from_token),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(ZygoCustomAPI).where(ZygoCustomAPI.owner_id == current_user.id))
    return result.scalars().all()

@zygo_router.post("/apis", response_model=ZygoCustomAPIOut)
async def create_api(
    payload: ZygoCustomAPICreate,
    current_user: ZygoUser = Depends(get_zygo_user_from_token),
    db: AsyncSession = Depends(get_db)
):
    api = ZygoCustomAPI(owner_id=current_user.id, **payload.dict())
    db.add(api)
    await db.commit()
    await db.refresh(api)
    return api

@zygo_router.delete("/apis/{api_id}")
async def delete_api(api_id: UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(ZygoCustomAPI).where(ZygoCustomAPI.id == api_id))
    api = result.scalars().first()
    if not api:
        raise HTTPException(status_code=404, detail="API not found")
    await db.delete(api)
    await db.commit()
    return {"ok": True}


# ── Google Resources ───────────────────────────────────────

@zygo_router.get("/google-resources", response_model=List[ZygoGoogleResourceOut])
async def list_google_resources(
    current_user: ZygoUser = Depends(get_zygo_user_from_token),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(ZygoGoogleResource).where(ZygoGoogleResource.owner_id == current_user.id))
    return result.scalars().all()

@zygo_router.post("/google-resources", response_model=ZygoGoogleResourceOut)
async def create_google_resource(
    payload: ZygoGoogleResourceCreate,
    current_user: ZygoUser = Depends(get_zygo_user_from_token),
    db: AsyncSession = Depends(get_db)
):
    resource = ZygoGoogleResource(owner_id=current_user.id, **payload.dict())
    db.add(resource)
    await db.commit()
    await db.refresh(resource)
    return resource

@zygo_router.delete("/google-resources/{resource_id}")
async def delete_google_resource(resource_id: UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(ZygoGoogleResource).where(ZygoGoogleResource.id == resource_id))
    resource = result.scalars().first()
    if not resource:
        raise HTTPException(status_code=404, detail="Resource not found")
    await db.delete(resource)
    await db.commit()
    return {"ok": True}


# ── Runs ───────────────────────────────────────────────────

@zygo_router.get("/runs", response_model=List[ZygoRunOut])
async def list_runs(
    current_user: ZygoUser = Depends(get_zygo_user_from_token),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(ZygoRun)
        .where(ZygoRun.owner_id == current_user.id)
        .order_by(ZygoRun.started_at.desc())
        .limit(100)
    )
    return result.scalars().all()


# ── Deploy pipeline from desktop app ──────────────────────

@zygo_router.post("/deploy")
async def deploy_pipeline(
    request: Request,
    current_user: ZygoUser = Depends(get_zygo_user_from_token),
    db: AsyncSession = Depends(get_db)
):
    """
    Called by desktop app when user clicks 'Deploy to Cloud'.
    Saves full pipeline + agents to Supabase.
    Returns permanent webhook URL.
    """
    import re
    data = await request.json()

    pipeline_name = data.get("name", "Unnamed Pipeline")
    agents_data = data.get("agents", [])
    max_rounds = data.get("max_rounds", 1)
    auto_mode = data.get("auto_mode", False)

    # Check if pipeline already exists → update, else create
    result = await db.execute(
        select(ZygoPipeline).where(
            ZygoPipeline.owner_id == current_user.id,
            ZygoPipeline.name == pipeline_name
        )
    )
    pipeline = result.scalars().first()

    if pipeline:
        pipeline.agent_names = [a["name"] for a in agents_data]
        pipeline.max_rounds = max_rounds
        pipeline.auto_mode = auto_mode
        # Delete old agents
        old = await db.execute(select(ZygoAgent).where(ZygoAgent.pipeline_id == pipeline.id))
        for agent in old.scalars().all():
            await db.delete(agent)
    else:
        pipeline = ZygoPipeline(
            owner_id=current_user.id,
            name=pipeline_name,
            agent_names=[a["name"] for a in agents_data],
            max_rounds=max_rounds,
            auto_mode=auto_mode
        )
        db.add(pipeline)
        await db.flush()

    # Save agents in order
    for i, a in enumerate(agents_data):
        db.add(ZygoAgent(
            pipeline_id=pipeline.id,
            owner_id=current_user.id,
            name=a.get("name", f"Agent {i+1}"),
            prompt=a.get("prompt", ""),
            generated_code=a.get("code", ""),
            model=a.get("model", "openai"),
            order_index=i
        ))

    # Auto-create webhook trigger
    slug = re.sub(r'[^a-z0-9-]', '-', pipeline_name.lower().strip())
    webhook_path = f"/zygo/webhook/{slug}"
    webhook_url = f"https://api.zygoflow.com/zygo/webhook/{slug}"

    trig_result = await db.execute(
        select(ZygoTrigger).where(ZygoTrigger.webhook_path == webhook_path)
    )
    if not trig_result.scalars().first():
        db.add(ZygoTrigger(
            owner_id=current_user.id,
            pipeline_id=pipeline.id,
            name=f"{pipeline_name} webhook",
            trigger_type=ZygoTriggerTypeEnum.webhook,
            webhook_path=webhook_path,
            webhook_public_url=webhook_url,
            display=f"POST {webhook_path}",
            is_enabled=True
        ))

    await db.commit()

    return {
        "ok": True,
        "pipeline_id": str(pipeline.id),
        "pipeline_name": pipeline_name,
        "webhook_url": webhook_url,
        "message": f"✅ Pipeline '{pipeline_name}' deployed!"
    }


# ── Incoming Webhooks (public, no auth) ────────────────────

@zygo_router.post("/webhook/{slug}")
async def receive_webhook(slug: str, request: Request, db: AsyncSession = Depends(get_db)):
    """Public endpoint — Stripe, Typeform, GitHub etc POST here."""
    path = f"/zygo/webhook/{slug}"
    result = await db.execute(
        select(ZygoTrigger).where(
            ZygoTrigger.webhook_path == path,
            ZygoTrigger.is_enabled == True
        )
    )
    trigger = result.scalars().first()

    if not trigger:
        raise HTTPException(status_code=404, detail=f"No active webhook for {path}")

    try:
        payload = await request.json()
    except Exception:
        payload = {}

    run = ZygoRun(
        owner_id=trigger.owner_id,
        pipeline_id=trigger.pipeline_id,
        trigger_id=trigger.id,
        status=ZygoRunStatusEnum.pending,
        trigger_source="webhook",
        trigger_payload=payload
    )
    db.add(run)
    await db.commit()
    await db.refresh(run)

    # TODO: trigger E2B execution (next step!)

    return {"status": "ok", "run_id": str(run.id)}
