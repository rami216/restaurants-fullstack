"""
Zygoflow Agent Platform — FastAPI Routes
Add to your main.py: app.include_router(zygo_router, prefix="/zygo", tags=["zygoflow"])
"""

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from typing import List
from uuid import UUID
import uuid

import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
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


# ── Helper ─────────────────────────────────────────────────

def get_zygo_user(user_id: UUID, db: Session) -> ZygoUser:
    user = db.query(ZygoUser).filter(ZygoUser.user_id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Zygo user not found")
    return user


# ── Users ──────────────────────────────────────────────────

@zygo_router.post("/users", response_model=ZygoUserOut)
def create_zygo_user(payload: ZygoUserCreate, db: Session = Depends(get_db)):
    existing = db.query(ZygoUser).filter(ZygoUser.email == payload.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="User already exists")
    user = ZygoUser(**payload.dict(), user_id=uuid.uuid4())
    db.add(user)
    db.commit()
    db.refresh(user)
    return user

@zygo_router.get("/users/{user_id}", response_model=ZygoUserOut)
def get_user(user_id: UUID, db: Session = Depends(get_db)):
    return get_zygo_user(user_id, db)

@zygo_router.patch("/users/{user_id}", response_model=ZygoUserOut)
def update_user(user_id: UUID, payload: ZygoUserUpdate, db: Session = Depends(get_db)):
    user = get_zygo_user(user_id, db)
    for field, value in payload.dict(exclude_unset=True).items():
        setattr(user, field, value)
    db.commit()
    db.refresh(user)
    return user


# ── Pipelines ──────────────────────────────────────────────

@zygo_router.get("/users/{user_id}/pipelines", response_model=List[ZygoPipelineOut])
def list_pipelines(user_id: UUID, db: Session = Depends(get_db)):
    user = get_zygo_user(user_id, db)
    return db.query(ZygoPipeline).filter(ZygoPipeline.owner_id == user.id).all()

@zygo_router.post("/users/{user_id}/pipelines", response_model=ZygoPipelineOut)
def create_pipeline(user_id: UUID, payload: ZygoPipelineCreate, db: Session = Depends(get_db)):
    user = get_zygo_user(user_id, db)
    pipeline = ZygoPipeline(owner_id=user.id, **payload.dict())
    db.add(pipeline)
    db.commit()
    db.refresh(pipeline)
    return pipeline

@zygo_router.patch("/pipelines/{pipeline_id}", response_model=ZygoPipelineOut)
def update_pipeline(pipeline_id: UUID, payload: ZygoPipelineUpdate, db: Session = Depends(get_db)):
    pipeline = db.query(ZygoPipeline).filter(ZygoPipeline.id == pipeline_id).first()
    if not pipeline:
        raise HTTPException(status_code=404, detail="Pipeline not found")
    for field, value in payload.dict(exclude_unset=True).items():
        setattr(pipeline, field, value)
    db.commit()
    db.refresh(pipeline)
    return pipeline

@zygo_router.delete("/pipelines/{pipeline_id}")
def delete_pipeline(pipeline_id: UUID, db: Session = Depends(get_db)):
    pipeline = db.query(ZygoPipeline).filter(ZygoPipeline.id == pipeline_id).first()
    if not pipeline:
        raise HTTPException(status_code=404, detail="Pipeline not found")
    db.delete(pipeline)
    db.commit()
    return {"ok": True}


# ── Agents ─────────────────────────────────────────────────

@zygo_router.post("/pipelines/{pipeline_id}/agents", response_model=ZygoAgentOut)
def create_agent(pipeline_id: UUID, payload: ZygoAgentCreate, db: Session = Depends(get_db)):
    pipeline = db.query(ZygoPipeline).filter(ZygoPipeline.id == pipeline_id).first()
    if not pipeline:
        raise HTTPException(status_code=404, detail="Pipeline not found")
    agent = ZygoAgent(pipeline_id=pipeline_id, owner_id=pipeline.owner_id, **payload.dict())
    db.add(agent)
    db.commit()
    db.refresh(agent)
    return agent

@zygo_router.patch("/agents/{agent_id}", response_model=ZygoAgentOut)
def update_agent(agent_id: UUID, payload: ZygoAgentUpdate, db: Session = Depends(get_db)):
    agent = db.query(ZygoAgent).filter(ZygoAgent.id == agent_id).first()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    for field, value in payload.dict(exclude_unset=True).items():
        setattr(agent, field, value)
    db.commit()
    db.refresh(agent)
    return agent

@zygo_router.delete("/agents/{agent_id}")
def delete_agent(agent_id: UUID, db: Session = Depends(get_db)):
    agent = db.query(ZygoAgent).filter(ZygoAgent.id == agent_id).first()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    db.delete(agent)
    db.commit()
    return {"ok": True}


# ── Triggers ───────────────────────────────────────────────

@zygo_router.get("/users/{user_id}/triggers", response_model=List[ZygoTriggerOut])
def list_triggers(user_id: UUID, db: Session = Depends(get_db)):
    user = get_zygo_user(user_id, db)
    return db.query(ZygoTrigger).filter(ZygoTrigger.owner_id == user.id).all()

@zygo_router.post("/users/{user_id}/triggers", response_model=ZygoTriggerOut)
def create_trigger(user_id: UUID, payload: ZygoTriggerCreate, db: Session = Depends(get_db)):
    import re
    user = get_zygo_user(user_id, db)
    trigger = ZygoTrigger(owner_id=user.id, **payload.dict())

    if payload.trigger_type == ZygoTriggerTypeEnum.webhook:
        slug = re.sub(r'[^a-z0-9-]', '-', payload.name.lower().strip())
        trigger.webhook_path = f"/webhook/{slug}"
        trigger.webhook_public_url = f"https://your-domain.com/webhook/{slug}"  # update with real domain

    db.add(trigger)
    db.commit()
    db.refresh(trigger)
    return trigger

@zygo_router.delete("/triggers/{trigger_id}")
def delete_trigger(trigger_id: UUID, db: Session = Depends(get_db)):
    trigger = db.query(ZygoTrigger).filter(ZygoTrigger.id == trigger_id).first()
    if not trigger:
        raise HTTPException(status_code=404, detail="Trigger not found")
    db.delete(trigger)
    db.commit()
    return {"ok": True}


# ── Custom APIs ────────────────────────────────────────────

@zygo_router.get("/users/{user_id}/apis", response_model=List[ZygoCustomAPIOut])
def list_apis(user_id: UUID, db: Session = Depends(get_db)):
    user = get_zygo_user(user_id, db)
    return db.query(ZygoCustomAPI).filter(ZygoCustomAPI.owner_id == user.id).all()

@zygo_router.post("/users/{user_id}/apis", response_model=ZygoCustomAPIOut)
def create_api(user_id: UUID, payload: ZygoCustomAPICreate, db: Session = Depends(get_db)):
    user = get_zygo_user(user_id, db)
    api = ZygoCustomAPI(owner_id=user.id, **payload.dict())
    db.add(api)
    db.commit()
    db.refresh(api)
    return api

@zygo_router.delete("/apis/{api_id}")
def delete_api(api_id: UUID, db: Session = Depends(get_db)):
    api = db.query(ZygoCustomAPI).filter(ZygoCustomAPI.id == api_id).first()
    if not api:
        raise HTTPException(status_code=404, detail="API not found")
    db.delete(api)
    db.commit()
    return {"ok": True}


# ── Google Resources ───────────────────────────────────────

@zygo_router.get("/users/{user_id}/google-resources", response_model=List[ZygoGoogleResourceOut])
def list_google_resources(user_id: UUID, db: Session = Depends(get_db)):
    user = get_zygo_user(user_id, db)
    return db.query(ZygoGoogleResource).filter(ZygoGoogleResource.owner_id == user.id).all()

@zygo_router.post("/users/{user_id}/google-resources", response_model=ZygoGoogleResourceOut)
def create_google_resource(user_id: UUID, payload: ZygoGoogleResourceCreate, db: Session = Depends(get_db)):
    user = get_zygo_user(user_id, db)
    resource = ZygoGoogleResource(owner_id=user.id, **payload.dict())
    db.add(resource)
    db.commit()
    db.refresh(resource)
    return resource

@zygo_router.delete("/google-resources/{resource_id}")
def delete_google_resource(resource_id: UUID, db: Session = Depends(get_db)):
    resource = db.query(ZygoGoogleResource).filter(ZygoGoogleResource.id == resource_id).first()
    if not resource:
        raise HTTPException(status_code=404, detail="Resource not found")
    db.delete(resource)
    db.commit()
    return {"ok": True}


# ── Runs ───────────────────────────────────────────────────

@zygo_router.get("/users/{user_id}/runs", response_model=List[ZygoRunOut])
def list_runs(user_id: UUID, db: Session = Depends(get_db)):
    user = get_zygo_user(user_id, db)
    return (
        db.query(ZygoRun)
        .filter(ZygoRun.owner_id == user.id)
        .order_by(ZygoRun.started_at.desc())
        .limit(100)
        .all()
    )


# ── Incoming Webhooks (public, no auth) ────────────────────

@zygo_router.post("/webhook/{slug}")
async def receive_webhook(slug: str, request: Request, db: Session = Depends(get_db)):
    """
    Public endpoint — receives POST from Stripe, Typeform, etc.
    Finds the matching trigger and queues a pipeline run.
    """
    path = f"/webhook/{slug}"
    trigger = db.query(ZygoTrigger).filter(
        ZygoTrigger.webhook_path == path,
        ZygoTrigger.is_enabled == True
    ).first()

    if not trigger:
        raise HTTPException(status_code=404, detail=f"No active webhook registered for {path}")

    try:
        payload = await request.json()
    except Exception:
        payload = {}

    # Create a run record
    run = ZygoRun(
        owner_id=trigger.owner_id,
        pipeline_id=trigger.pipeline_id,
        trigger_id=trigger.id,
        status=ZygoRunStatusEnum.pending,
        trigger_source="webhook",
        trigger_payload=payload
    )
    db.add(run)
    db.commit()
    db.refresh(run)

    # TODO: queue actual pipeline execution (Celery, background task, etc)
    # For now just records the run — execution engine comes next session

    return {"status": "ok", "run_id": str(run.id), "pipeline_id": str(trigger.pipeline_id)}
