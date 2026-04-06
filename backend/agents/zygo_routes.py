"""
Zygoflow Agent Platform — FastAPI Routes(zygo_routes.py)
"""

import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from fastapi import APIRouter, Depends, HTTPException, Request, Header
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from typing import List, Optional
from uuid import UUID
import secrets
import asyncio
from fastapi import BackgroundTasks

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
from sqlalchemy.orm import selectinload

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
    result = await db.execute(
        select(ZygoPipeline)
        .where(ZygoPipeline.owner_id == current_user.id)
        .options(selectinload(ZygoPipeline.agents))  # ← ADD THIS
    )
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


@zygo_router.get("/subscription")
async def get_subscription(
    current_user: ZygoUser = Depends(get_zygo_user_from_token),
    db: AsyncSession = Depends(get_db)
):
    from agents.zygo_models import ZygoSubscription
    result = await db.execute(select(ZygoSubscription).where(ZygoSubscription.user_id == current_user.id))
    sub = result.scalars().first()
    if not sub:
        sub = ZygoSubscription(user_id=current_user.id)
        db.add(sub)
        await db.commit()
        await db.refresh(sub)
    return {
        "status": sub.status,
        "plan": sub.plan,
        "runs_used": sub.runs_used,
        "runs_limit": sub.runs_limit,
        "stripe_customer_id": sub.stripe_customer_id,
    }

async def check_and_increment_runs(owner_id, db: AsyncSession) -> bool:
    """Returns True if allowed to run, False if limit reached."""
    from agents.zygo_models import ZygoSubscription, ZygoTrigger
    result = await db.execute(select(ZygoSubscription).where(ZygoSubscription.user_id == owner_id))
    sub = result.scalars().first()
    if not sub:
        sub = ZygoSubscription(user_id=owner_id)
        db.add(sub)
        await db.commit()
        await db.refresh(sub)

    if sub.runs_used >= sub.runs_limit:
        # Pause all their triggers
        triggers_result = await db.execute(
            select(ZygoTrigger).where(ZygoTrigger.owner_id == owner_id)
        )
        for trigger in triggers_result.scalars().all():
            trigger.is_enabled = False
        await db.commit()
        return False

    sub.runs_used += 1
    await db.commit()
    return True
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


@zygo_router.patch("/triggers/{trigger_id}")
async def update_trigger(trigger_id: UUID, request: Request, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(ZygoTrigger).where(ZygoTrigger.id == trigger_id))
    trigger = result.scalars().first()
    if not trigger:
        raise HTTPException(status_code=404, detail="Trigger not found")
    data = await request.json()
    if "is_enabled" in data:
        trigger.is_enabled = data["is_enabled"]
    await db.commit()
    await db.refresh(trigger)
    return {"ok": True, "is_enabled": trigger.is_enabled}

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
    Saves full pipeline + agents + all keys to Supabase.
    Returns permanent webhook URL.
    """
    import re
    data = await request.json()

    pipeline_name = data.get("name", "Unnamed Pipeline")
    agents_data = data.get("agents", [])
    max_rounds = data.get("max_rounds", 1)
    auto_mode = data.get("auto_mode", False)

    # ── Save all keys + context to the user record ─────────────
    # These are needed by E2B at execution time
    if data.get("e2b_api_key"):
        current_user.e2b_api_key = data["e2b_api_key"]
    if data.get("openai_api_key"):
        current_user.openai_api_key = data["openai_api_key"]
    if data.get("claude_api_key"):
        current_user.claude_api_key = data["claude_api_key"]
    if data.get("google_service_account"):
        current_user.google_service_account = data["google_service_account"]
    if data.get("custom_apis"):
        current_user.custom_apis_data = data["custom_apis"]
    if data.get("google_resources"):
        current_user.google_resources_data = data["google_resources"]
    # ✅ NEW: Save the website context sent from the desktop app
    if data.get("website_id"):
        current_user.website_id = data["website_id"]
    if "website_tables" in data:
        current_user.website_tables_data = data["website_tables"]

    # ── Check if pipeline already exists → update, else create ─
    result = await db.execute(
        select(ZygoPipeline).where(
            ZygoPipeline.owner_id == current_user.id,
            ZygoPipeline.name == pipeline_name
        )
    )
    pipeline = result.scalars().first()
    is_xyz_flag = data.get("is_xyz", False) # Extract it from the payload
    if pipeline:
        pipeline.agent_names = [a["name"] for a in agents_data]
        pipeline.max_rounds = max_rounds
        pipeline.auto_mode = auto_mode
        pipeline.is_xyz = is_xyz_flag # 🔥 Update existing
        # Delete old agents and replace
        old = await db.execute(select(ZygoAgent).where(ZygoAgent.pipeline_id == pipeline.id))
        for agent in old.scalars().all():
            await db.delete(agent)
    else:
        pipeline = ZygoPipeline(
            owner_id=current_user.id,
            name=pipeline_name,
            agent_names=[a["name"] for a in agents_data],
            max_rounds=max_rounds,
            auto_mode=auto_mode,
            is_xyz=is_xyz_flag # 🔥 Create new
        )
        db.add(pipeline)
        await db.flush()

    # ── Save agents in order ────────────────────────────────────
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

    # ── Auto-create permanent webhook trigger ───────────────────
    slug = re.sub(r'[^a-z0-9-]', '-', pipeline_name.lower().strip())
    webhook_path = f"/zygo/webhook/{slug}"
    webhook_url = f"https://api.zygoflow.com/zygo/webhook/{slug}"

    trig_result = await db.execute(
        select(ZygoTrigger).where(ZygoTrigger.webhook_path == webhook_path)
    )
    existing_trigger = trig_result.scalars().first()
    if not existing_trigger:
        db.add(ZygoTrigger(
            owner_id=current_user.id,
            pipeline_id=pipeline.id,
            name=f"{pipeline_name} webhook",
            trigger_type="webhook",
            webhook_path=webhook_path,
            webhook_public_url=webhook_url,
            display=f"POST {webhook_path}",
            is_enabled=True
        ))
    # ── Save scheduled trigger if provided ─────────────────────  ← ADD FROM HERE
    trigger_data = data.get("trigger")
    if trigger_data and trigger_data.get("type") in ("interval", "daily"):
        # Delete old scheduled trigger for this pipeline if exists
        old_sched = await db.execute(
            select(ZygoTrigger).where(
                ZygoTrigger.pipeline_id == pipeline.id,
                ZygoTrigger.trigger_type.in_([ZygoTriggerTypeEnum.interval, ZygoTriggerTypeEnum.daily])

            )
        )
        for old in old_sched.scalars().all():
            await db.delete(old)

        db.add(ZygoTrigger(
            owner_id=current_user.id,
            pipeline_id=pipeline.id,
            name=trigger_data.get("name", f"{pipeline_name}-schedule"),
            trigger_type="interval" if trigger_data.get("type") == "interval" else "daily",
            is_enabled=True,
            interval_value=trigger_data.get("interval_value"),
            interval_unit=trigger_data.get("interval_unit"),
            daily_time=trigger_data.get("daily_time"),
            display=f"Every {trigger_data.get('interval_value')} {trigger_data.get('interval_unit')}" if trigger_data.get("type") == "interval" else f"Daily at {trigger_data.get('daily_time')}",
        ))      
    await db.commit()

    return {
        "ok": True,
        "pipeline_id": str(pipeline.id),
        "pipeline_name": pipeline_name,
        "webhook_url": webhook_url,
        "message": f"Pipeline '{pipeline_name}' deployed!"
    }


# ── Incoming Webhooks (public, no auth) ────────────────────

@zygo_router.post("/webhook/{slug}")
async def receive_webhook(slug: str, request: Request, background_tasks: BackgroundTasks, db: AsyncSession = Depends(get_db)):
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

    # Load owner for keys
    owner_result = await db.execute(select(ZygoUser).where(ZygoUser.id == trigger.owner_id))
    owner = owner_result.scalars().first()

    # Load pipeline + agents
    pipeline_result = await db.execute(select(ZygoPipeline).where(ZygoPipeline.id == trigger.pipeline_id))
    pipeline = pipeline_result.scalars().first()

    agents_result = await db.execute(
        select(ZygoAgent)
        .where(ZygoAgent.pipeline_id == trigger.pipeline_id)
        .order_by(ZygoAgent.order_index)
    )
    agents = agents_result.scalars().all()
    # Check subscription limits
    allowed = await check_and_increment_runs(trigger.owner_id, db)
    if not allowed:
        raise HTTPException(status_code=402, detail="Run limit reached. Please upgrade your plan.")
    # Create run record
    run = ZygoRun(
        owner_id=trigger.owner_id,
        pipeline_id=trigger.pipeline_id,
        trigger_id=trigger.id,
        status=ZygoRunStatusEnum.running,
        trigger_source="webhook",
        trigger_payload=payload
    )
    db.add(run)
    await db.commit()
    await db.refresh(run)

    # Fire E2B execution in background
    # Fire E2B execution in background
    background_tasks.add_task(
        run_pipeline_on_e2b_sync,
        run_id=str(run.id),
        owner_id=str(owner.id),
        e2b_key=owner.e2b_api_key,
        openai_key=owner.openai_api_key or "",
        claude_key=owner.claude_api_key or "",
        google_sa=owner.google_service_account,
        custom_apis=owner.custom_apis_data,
        pipeline_max_rounds=pipeline.max_rounds or 1,
        pipeline_auto_mode=pipeline.auto_mode or False,
        pipeline_is_xyz=pipeline.is_xyz or False,  # ✅ ADDED
        agents_data=[(a.name, a.generated_code or "") for a in agents],
        trigger_payload=payload,
        database_url=os.environ.get("DATABASE_URL", ""),
        # ✅ NEW: Pass the website context to E2B! 
        # (We use owner.api_token because the backend already knows their Zygoflow token!)
        website_id=owner.website_id,
        zygo_token=owner.api_token, 
        website_tables=owner.website_tables_data or {}
    )

    return {"status": "ok", "run_id": str(run.id)}

    


# ── E2B Execution Engine ────────────────────────────────────

def run_pipeline_on_e2b_sync(run_id, owner_id, e2b_key, openai_key, claude_key,
                               google_sa, custom_apis, pipeline_max_rounds,
                               pipeline_auto_mode, pipeline_is_xyz, agents_data, trigger_payload, database_url, website_id, zygo_token, website_tables):
    from e2b_code_interpreter import Sandbox
    import json, asyncio
    from sqlalchemy import create_engine
    from sqlalchemy.orm import sessionmaker
    from agents.zygo_models import ZygoRun, ZygoRunStatusEnum

    logs = []
    def log(msg):
        logs.append(msg)
        print(f"[E2B:{run_id}] {msg}", flush=True)
        
    def update_run(status, log_text):
        try:
            sync_url = database_url.replace("postgresql+asyncpg://", "postgresql://")
            engine = create_engine(sync_url)
            Session = sessionmaker(bind=engine)
            session = Session()
            run = session.query(ZygoRun).filter(ZygoRun.id == run_id).first()
            if run:
                run.status = status
                run.logs = log_text
                session.commit()
            session.close()
            engine.dispose()
        except Exception as e:
            print(f"DB update error: {e}")

    log(f"🚀 Starting E2B sync function")
    log(f"🔑 E2B key present: {bool(e2b_key)}")
    log(f"🤖 Agents count: {len(agents_data)}")
    update_run(ZygoRunStatusEnum.running, "\n".join(logs))

    try:
        if not e2b_key:
            raise Exception("No E2B API key")

        os.environ["E2B_API_KEY"] = e2b_key
        sbx = Sandbox()
        log("✅ Sandbox started")

        # Install packages
        import re as _re
        all_code = " ".join([code for _, code in agents_data])

        package_map = {
            'googleapiclient': 'google-api-python-client',
            'google': 'google-auth google-auth-httplib2 google-api-python-client',
            'bs4': 'beautifulsoup4',
            'PIL': 'Pillow',
            'sklearn': 'scikit-learn',
            'cv2': 'opencv-python',
            'dotenv': 'python-dotenv',
            'yaml': 'pyyaml',
            'jwt': 'PyJWT',
            'docx': 'python-docx',
            'pptx': 'python-pptx',
            'openpyxl': 'openpyxl',
            'xlrd': 'xlrd',
            'PyPDF2': 'PyPDF2',
            'pdfplumber': 'pdfplumber',
            'fitz': 'pymupdf',
            'stripe': 'stripe',
            'twilio': 'twilio',
            'boto3': 'boto3',
            'pymongo': 'pymongo',
            'redis': 'redis',
            'sendgrid': 'sendgrid',
        }

        stdlib = {
            'os', 'sys', 'json', 're', 'time', 'datetime', 'math', 'random',
            'string', 'io', 'csv', 'pathlib', 'collections', 'itertools',
            'functools', 'threading', 'subprocess', 'hashlib', 'base64',
            'uuid', 'copy', 'typing', 'enum', 'abc', 'contextlib', 'logging',
            'tempfile', 'shutil', 'glob', 'struct', 'socket', 'http', 'urllib',
            'importlib', 'inspect', 'traceback', 'warnings', 'dataclasses'
        }

        packages = {'openai', 'anthropic', 'google-auth', 'google-auth-httplib2', 'google-api-python-client', 'requests'}

        imported = set()
        for match in _re.findall(r'^(?:import|from)\s+([a-zA-Z0-9_]+)', all_code, _re.MULTILINE):
            imported.add(match)

        for pkg in imported:
            if pkg in stdlib: continue
            if pkg in package_map:
                for p in package_map[pkg].split(): packages.add(p)
            else:
                packages.add(pkg)

        install_cmd = "pip install " + " ".join(packages) + " -q"
        install_result = sbx.commands.run(install_cmd)
        log(f"✅ Packages installed (exit code: {install_result.exit_code})")

        # Bootstrap
        bootstrap_lines = [
            "import json, os",
            "import requests",
            f"import json as _json; trigger_payload = _json.loads({repr(json.dumps(trigger_payload))})",
            f"openai_api_key = {repr(openai_key)}",
            f"claude_api_key = {repr(claude_key)}",
            "if openai_api_key:\n    from openai import OpenAI\n    openai_client = OpenAI(api_key=openai_api_key)",
            "if claude_api_key:\n    from anthropic import Anthropic\n    claude_client = Anthropic(api_key=claude_api_key)",
            f"website_id = {repr(website_id)}",
            f"zygo_token = {repr(zygo_token)}",
            f"ZYGO_HEADERS = {{'Authorization': f'Bearer {{zygo_token}}'}}",
            f"website_tables = _json.loads({repr(json.dumps(website_tables))})",
        ]       

        if custom_apis:
            for api in custom_apis:
                if api.get("key_variable") and api.get("api_key"):
                    bootstrap_lines.append(f"{api['key_variable']} = {repr(api['api_key'])}")
                if api.get("function_code"):
                    bootstrap_lines.append(api["function_code"])

        if google_sa:
            sa_json = json.dumps(google_sa)
            bootstrap_lines += [
                "import tempfile as _tmp",
                f"_sa_data = {repr(sa_json)}",
                "_sa_file = _tmp.NamedTemporaryFile(mode='w', suffix='.json', delete=False)",
                "_sa_file.write(_sa_data); _sa_file.close()",
                "_sa_path = _sa_file.name",
                "def _get_google_creds(scopes):",
                "    from google.oauth2 import service_account",
                "    return service_account.Credentials.from_service_account_file(_sa_path, scopes=scopes)",
            ]

        bootstrap_code = "\n".join(bootstrap_lines)
        log("✅ Bootstrap injected")

        # ── Execution Logic ──
        agents_dict = {name: code for name, code in agents_data}
        agent_names = [name for name, _ in agents_data]

        if pipeline_is_xyz:
            # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
            # 🕸️ ROUTE 1: XYZ SWARM MODE (PARALLEL)
            # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
            log("🕸️ XYZ Mode Detected: Launching Parallel Swarm in E2B")
            
            xyz_bootstrap = f"""
import threading
import time
import json as _json
import openai as _oai

_blackboard = {{}}
_bb_lock = threading.Lock()
_openai_key = {repr(openai_key)}

def pm_push(key, value):
    with _bb_lock:
        _blackboard[key] = value
    print(f"📌 Pushed '{{key}}' to blackboard.")

def semantic_wait(description, expected_count, timeout=300):
    print(f"🚦 Semantic Wait: waiting for {{expected_count}} items on blackboard...")
    
    # 1. Block until expected_count items are on blackboard
    start_time = time.time()
    while time.time() - start_time < timeout:
        with _bb_lock:
            if len(_blackboard) >= expected_count:
                break
        time.sleep(1)
    else:
        raise Exception(f"Timeout waiting for {{expected_count}} items on blackboard.")

    # 2. Build lightweight Memory Map (keys + types + sizes only — NOT the data)
    with _bb_lock:
        m_map = {{k: f"Type: {{type(v).__name__}}, Size: {{len(v) if isinstance(v, (str, list, dict)) else 1}}" for k, v in _blackboard.items()}}
    print(f"🗺️ Memory Map: {{m_map}}")

    # 3. Ask AI router to match description to variable keys
    prompt = (
        f"You are a Swarm Semantic Router.\\n"
        f"An agent is asking for this data: '{{description}}'\\n"
        f"Here is the current Memory Map of the blackboard: {{_json.dumps(m_map)}}\\n"
        f"Return a JSON object with a 'keys' array containing the exact variable names that match.\\n"
        f"Example: {{{{\\\"keys\\\": [\\\"var1\\\", \\\"var2\\\"]}}}}"
    )
    client = _oai.OpenAI(api_key=_openai_key)
    resp = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[{{"role": "user", "content": prompt}}],
        response_format={{"type": "json_object"}}
    )
    keys_data = _json.loads(resp.choices[0].message.content)
    target_keys = keys_data.get("keys", [])
    print(f"🎯 Router matched keys: {{target_keys}}")

    # 4. Grab the actual heavy data from blackboard
    with _bb_lock:
        results = [_blackboard[k] for k in target_keys if k in _blackboard]
    
    if len(results) == 1:
        return results[0]
    return results

def save_file(default_ext=".txt", file_types=None):
    return f"final_output{{default_ext}}"
"""
            producers = []
            consumer_code = ""
            for name, code in agents_data:
                if "semantic_wait" in code or "pm_wait" in code:
                    consumer_code = code
                else:
                    producers.append((name, code))

            xyz_run_script = """
def run_producer(name, code_str):
    try:
        print(f"▶ Running: {name}")
        exec(code_str, globals())
    except Exception as e:
        print(f"❌ Execution error in {name}: {e}")

threads = []
"""
            for i, (p_name, p_code) in enumerate(producers):
                xyz_run_script += f"\np_code_{i} = {repr(p_code)}\n"
                xyz_run_script += f"t = threading.Thread(target=run_producer, args=({repr(p_name)}, p_code_{i}))\n"
                xyz_run_script += "threads.append(t)\n"

            # Start ALL threads together, then launch consumer
            xyz_run_script += "\nfor t in threads: t.start()\n"
            if consumer_code:
                xyz_run_script += f"\nprint('▶ Running: Consumer (waiting for producers...)')\nexec({repr(consumer_code)}, globals())\n"
            xyz_run_script += "\nfor t in threads: t.join()\n"

            result = sbx.run_code(bootstrap_code + "\n" + xyz_bootstrap + "\n" + xyz_run_script)
            
            output = "\n".join(getattr(result.logs, 'stdout', None) or [])
            errors = "\n".join(getattr(result.logs, 'stderr', None) or [])
            if output: log(f"📤\n{output}")
            if errors: log(f"⚠️\n{errors}")
            
            if hasattr(result, 'error') and result.error:
                log(f"❌ Execution error: {result.error}")
                update_run(ZygoRunStatusEnum.failed, "\n".join(logs))
            elif "❌" in output:
                update_run(ZygoRunStatusEnum.failed, "\n".join(logs))
            else:
                log("✅ Pipeline complete (is_done=True)")
                update_run(ZygoRunStatusEnum.success, "\n".join(logs))

        else:
            # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
            # 🔗 ROUTE 2: STANDARD SEQUENTIAL MODE
            # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
            if pipeline_auto_mode:
                pipeline_max_rounds = 999999

            current_agent_name = agent_names[0]
            round_num = 0

            while True:
                round_num += 1
                if round_num > pipeline_max_rounds: break

                code = agents_dict.get(current_agent_name)
                if not code: break

                log(f"▶ Running: {current_agent_name}")
                update_run(ZygoRunStatusEnum.running, "\n".join(logs))  

                sbx.run_code("if 'next_agent' in globals(): del globals()['next_agent']")
                result = sbx.run_code(bootstrap_code + "\n\n" + code)

                output = "\n".join(getattr(result.logs, 'stdout', None) or [])
                errors = "\n".join(getattr(result.logs, 'stderr', None) or [])
                if output: log(f"📤 {output[:500]}")
                if errors: log(f"⚠️ {errors[:300]}")
                
                if hasattr(result, 'error') and result.error:
                    log(f"❌ Execution error: {result.error}")
                    update_run(ZygoRunStatusEnum.failed, "\n".join(logs))  
                    break

                update_run(ZygoRunStatusEnum.running, "\n".join(logs))  

                check_done = sbx.run_code("print(str(globals().get('is_done', False)))")
                if check_done.logs.stdout and "True" in check_done.logs.stdout[0]:
                    log("✅ Pipeline complete (is_done=True)")
                    update_run(ZygoRunStatusEnum.success, "\n".join(logs))
                    break

                check_routing = sbx.run_code("print(str(globals().get('next_agent', 'None')))")
                next_agent = check_routing.logs.stdout[0].strip() if check_routing.logs.stdout else "None"

                if next_agent != "None" and next_agent in agents_dict:
                    current_agent_name = next_agent
                else:
                    idx = agent_names.index(current_agent_name)
                    current_agent_name = agent_names[(idx + 1) % len(agent_names)]

                if not pipeline_auto_mode:
                    log("✅ Pipeline complete")
                    update_run(ZygoRunStatusEnum.success, "\n".join(logs))
                    break

        sbx.kill()

    except Exception as e:
        log(f"❌ {e}")
        update_run(ZygoRunStatusEnum.failed, "\n".join(logs))


#region zygoagents-subs
@zygo_router.post("/stripe-webhook")
async def zygo_stripe_webhook(
    request: Request,
    stripe_signature: str = Header(None),
    db: AsyncSession = Depends(get_db)
):
    import stripe
    from agents.zygo_models import ZygoSubscription, ZygoTrigger

    stripe.api_key = os.environ.get("STRIPE_SECRET_KEY")
    webhook_secret = os.environ.get("ZYGO_STRIPE_WEBHOOK_SECRET")
    zygo_price_id = os.environ.get("ZYGO_PRICE_ID")  # your Zygo plan price ID

    body = await request.body()
    try:
        event = stripe.Webhook.construct_event(
            payload=body, sig_header=stripe_signature, secret=webhook_secret
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

    session = event["data"]["object"]
    print(f"\n--- 🤖 ZYGO STRIPE WEBHOOK: {event['type']} ---")

    # ── User subscribes for the first time ─────────────────
    if event["type"] == "checkout.session.completed":
        md = session.get("metadata", {})
        zygo_user_id = md.get("zygo_user_id")
        if not zygo_user_id:
            print("❌ No zygo_user_id in metadata")
            return {"status": "ok"}

        result = await db.execute(select(ZygoSubscription).where(ZygoSubscription.user_id == zygo_user_id))
        sub = result.scalars().first()
        if not sub:
            sub = ZygoSubscription(user_id=zygo_user_id)
            db.add(sub)

        sub.stripe_customer_id = session.get("customer")
        sub.stripe_subscription_id = session.get("subscription")
        sub.status = "active"
        sub.plan = "pro"
        sub.runs_used = 0
        sub.runs_limit = 999999  # unlimited for pro

        # Re-enable all their triggers
        triggers_result = await db.execute(
            select(ZygoTrigger).where(ZygoTrigger.owner_id == zygo_user_id)
        )
        for trigger in triggers_result.scalars().all():
            trigger.is_enabled = True

        await db.commit()
        print(f"✅ Zygo user {zygo_user_id} upgraded to Pro")

    # ── Monthly renewal ─────────────────────────────────────
    elif event["type"] == "invoice.payment_succeeded":
        stripe_subscription_id = session.get("subscription")
        if not stripe_subscription_id:
            return {"status": "ok"}

        result = await db.execute(
            select(ZygoSubscription).where(ZygoSubscription.stripe_subscription_id == stripe_subscription_id)
        )
        sub = result.scalars().first()
        if sub:
            sub.status = "active"
            sub.runs_used = 0  # reset monthly
            sub.runs_limit = 999999

            # Re-enable all their triggers
            triggers_result = await db.execute(
                select(ZygoTrigger).where(ZygoTrigger.owner_id == sub.user_id)
            )
            for trigger in triggers_result.scalars().all():
                trigger.is_enabled = True

            await db.commit()
            print(f"✅ Zygo subscription renewed for {sub.user_id}")

    # ── Subscription cancelled ──────────────────────────────
    elif event["type"] == "customer.subscription.deleted":
        stripe_subscription_id = session.get("id")
        result = await db.execute(
            select(ZygoSubscription).where(ZygoSubscription.stripe_subscription_id == stripe_subscription_id)
        )
        sub = result.scalars().first()
        if sub:
            sub.status = "free"
            sub.plan = "free"
            sub.runs_limit = 50

            # Pause all their triggers
            triggers_result = await db.execute(
                select(ZygoTrigger).where(ZygoTrigger.owner_id == sub.user_id)
            )
            for trigger in triggers_result.scalars().all():
                trigger.is_enabled = False

            await db.commit()
            print(f"⚠️ Zygo subscription cancelled for {sub.user_id}")

    print(f"--- 🤖 ZYGO STRIPE WEBHOOK END ---\n")
    return {"status": "ok"}


# ── Create Zygo Checkout Session ───────────────────────────

@zygo_router.post("/subscribe")
async def create_zygo_checkout(
    current_user: ZygoUser = Depends(get_zygo_user_from_token),
    db: AsyncSession = Depends(get_db)
):
    import stripe
    from agents.zygo_models import ZygoSubscription

    stripe.api_key = os.environ.get("STRIPE_SECRET_KEY")
    zygo_price_id = os.environ.get("ZYGO_PRICE_ID")

    result = await db.execute(select(ZygoSubscription).where(ZygoSubscription.user_id == current_user.id))
    sub = result.scalars().first()
    if not sub:
        sub = ZygoSubscription(user_id=current_user.id)
        db.add(sub)
        await db.commit()
        await db.refresh(sub)

    try:
        checkout = stripe.checkout.Session.create(
            payment_method_types=["card"],
            line_items=[{"price": zygo_price_id, "quantity": 1}],
            mode="subscription",
            success_url="https://zygoflow.com/agents?subscribed=true",
            cancel_url="https://zygoflow.com/agents",
            customer_email=current_user.email,
            metadata={
                "zygo_user_id": str(current_user.id),
                "type": "zygo_subscription"
            }
        )
        return {"checkout_url": checkout.url}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@zygo_router.post("/unsubscribe")
async def cancel_zygo_subscription(
    current_user: ZygoUser = Depends(get_zygo_user_from_token),
    db: AsyncSession = Depends(get_db)
):
    import stripe
    from agents.zygo_models import ZygoSubscription

    stripe.api_key = os.environ.get("STRIPE_SECRET_KEY")

    result = await db.execute(select(ZygoSubscription).where(ZygoSubscription.user_id == current_user.id))
    sub = result.scalars().first()
#ss
    if not sub or sub.plan != "pro":
        raise HTTPException(status_code=400, detail="No active subscription to cancel")

    try:
        # Cancel at period end — user keeps Pro until billing cycle ends
        stripe.Subscription.modify(
            sub.stripe_subscription_id,
            cancel_at_period_end=True
        )
        return {"ok": True, "message": "Subscription will cancel at end of billing period"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    
    
#region website-agent-bridge

# ── Website Bridge ─────────────────────────────────────────

@zygo_router.get("/my-website")
async def get_my_website(
    current_user: ZygoUser = Depends(get_zygo_user_from_token),
    db: AsyncSession = Depends(get_db)
):
    from website_builder.models import Website
    from models import RestaurantOwner

    # 1. Find RestaurantOwner via user_id
    ro_result = await db.execute(
        select(RestaurantOwner).where(RestaurantOwner.user_id == current_user.user_id)
    )
    restaurant_owner = ro_result.scalars().first()
    if not restaurant_owner:
        raise HTTPException(status_code=404, detail="No restaurant found for this user.")

    # 2. Check subscription
    if restaurant_owner.subscription_status != "active":
        raise HTTPException(
            status_code=403,
            detail="Active subscription required to use the website bridge."
        )

    # 3. Find Website via restaurant_id
    website_result = await db.execute(
        select(Website).where(Website.restaurant_id == restaurant_owner.restaurant_id)
    )
    website = website_result.scalars().first()
    if not website:
        raise HTTPException(status_code=404, detail="No website found for this user.")

    return {
        "website_id": str(website.website_id),
        "subdomain": website.subdomain,
        "subscription_active": restaurant_owner.subscription_status == "active"
    }