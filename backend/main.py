# main.py
import os
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import Response
from agents.zygo_routes import zygo_router

# If you want to keep .env loading locally:
try:
    from dotenv import load_dotenv  # requires python-dotenv in requirements
    load_dotenv()
except Exception:
    pass

from database import init_db
from auth.router import router as auth_router
from restaurants.router import router as restaurants_router
from locations.router import router as locations_router
from menu_items.router import router as menus_router
from extras.router import router as extras_router
from menu_item_extras.router import router as menu_item_extrasRouter
from option_groups.router import router as options_grounpRouter
from option_choices.router import router as optionschoices
from menu_item_options.router import router as menuitemoptions
from schedules.router import router as schedulesrouter
from payments.router import router as paymentRouter
from website_builder.router import router as websiteBuilderRouter
from uploads.router import router as uploads_router
from ai.router import router as ai_router
from website_builder.site_auth_router import router as site_auth_router
from website_builder.site_member_payments.router import router as site_member_payments_router
from website_builder.custom_domains_router import router as custom_domains_router
from website_builder.public_router import router as public_router
from website_builder.stripe_checkout_router import router as checkout_router
from webhooks.router import router as webhooks_router # ✅ ADD THIS
from website_builder.orders_router import router as orders_router # ✅ ADD THIS
from website_builder.custom_data_router import router as custom_data_router # ✅ ADD THIS
import agents.zygo_models  # noqa — registers zygo tables with Base

#region triggers
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from agents.zygo_models import ZygoTrigger, ZygoTriggerTypeEnum, ZygoPipeline, ZygoAgent, ZygoUser, ZygoRun, ZygoRunStatusEnum
from database import async_session_maker
import uuid
from datetime import datetime, timezone
from fastapi import BackgroundTasks
from agents.zygo_routes import run_pipeline_on_e2b_sync


scheduler = AsyncIOScheduler()

async def check_scheduled_triggers():
    async with async_session_maker() as db:
        result = await db.execute(
            select(ZygoTrigger).where(
                ZygoTrigger.trigger_type == ZygoTriggerTypeEnum.scheduled,
                ZygoTrigger.is_enabled == True
            )
        )
        triggers = result.scalars().all()
        now = datetime.now(timezone.utc)

        for trigger in triggers:
            if not should_fire(trigger, now):
                continue

            owner_result = await db.execute(select(ZygoUser).where(ZygoUser.id == trigger.owner_id))
            owner = owner_result.scalars().first()

            pipeline_result = await db.execute(select(ZygoPipeline).where(ZygoPipeline.id == trigger.pipeline_id))
            pipeline = pipeline_result.scalars().first()

            agents_result = await db.execute(
                select(ZygoAgent)
                .where(ZygoAgent.pipeline_id == trigger.pipeline_id)
                .order_by(ZygoAgent.order_index)
            )
            agents = agents_result.scalars().all()

            run = ZygoRun(
                owner_id=trigger.owner_id,
                pipeline_id=trigger.pipeline_id,
                trigger_id=trigger.id,
                status=ZygoRunStatusEnum.running,
                trigger_source="scheduled",
                trigger_payload={}
            )
            db.add(run)
            await db.commit()
            await db.refresh(run)

            import threading
            threading.Thread(target=run_pipeline_on_e2b_sync, kwargs=dict(
                run_id=str(run.id),
                owner_id=str(owner.id),
                e2b_key=owner.e2b_api_key,
                openai_key=owner.openai_api_key or "",
                claude_key=owner.claude_api_key or "",
                google_sa=owner.google_service_account,
                custom_apis=owner.custom_apis_data,
                pipeline_max_rounds=pipeline.max_rounds or 1,
                pipeline_auto_mode=pipeline.auto_mode or False,
                agents_data=[(a.name, a.generated_code or "") for a in agents],
                trigger_payload={},
                database_url=os.environ.get("DATABASE_URL", "")
            ), daemon=True).start()

def should_fire(trigger, now):
    if trigger.interval_value and trigger.interval_unit:
        # every X minutes/hours/days
        if not trigger.last_fired_at:
            return True
        delta = now - trigger.last_fired_at
        if trigger.interval_unit == "minutes" and delta.seconds >= trigger.interval_value * 60:
            return True
        if trigger.interval_unit == "hours" and delta.seconds >= trigger.interval_value * 3600:
            return True
        if trigger.interval_unit == "days" and delta.days >= trigger.interval_value:
            return True
    if trigger.daily_time:
        # run once per day at specific time
        if now.strftime("%H:%M") == trigger.daily_time and (not trigger.last_fired_at or trigger.last_fired_at.date() < now.date()):
            return True
    return False





origins_env = os.getenv("FRONTEND_ORIGIN", "")
ALLOWED_ORIGINS = [o.strip() for o in origins_env.split(",") if o.strip()]

app = FastAPI()

@app.on_event("startup")
async def on_startup():
    await init_db()
    scheduler.add_job(check_scheduled_triggers, "interval", minutes=1)
    scheduler.start()

PUBLIC_RULES = [
    # Specific public routes first
    ("/users-stripe-account/", {"GET", "POST", "OPTIONS"}),

    # General public routes
    ("/site-auth", {"GET", "POST", "OPTIONS"}),
    ("/checkout/", {"POST", "OPTIONS"}),
    ("/cod/", {"POST", "OPTIONS"}), # ADD THIS LINE
    ("/public/", {"GET", "OPTIONS"}),
    ("/locations/", {"GET", "OPTIONS"}),
    ("/menu-item-extras/", {"GET", "OPTIONS"}),
    ("/menu-item-options/", {"GET", "OPTIONS"}),
    ("/uploads/", {"GET", "POST", "OPTIONS"}),
    ("/custom-data/", {"POST", "GET", "PUT", "DELETE", "OPTIONS"}),
    ("/builder/form-submissions", {"POST", "OPTIONS"}),
    ("/builder/send-email", {"POST", "OPTIONS"}),  # <--- Add this line
    ("/builder/openai", {"POST", "OPTIONS"}),
    ("/builder/parse-pdf", {"POST", "OPTIONS"}),
    ("/builder/fetch-external", {"POST", "OPTIONS"}),

    
]

def _is_has_purchase(path: str) -> bool:
    # /users-stripe-account/{subdomain}/has-purchase
    return path.startswith("/users-stripe-account/") and "/has-purchase" in path


def _allowed_methods_for(path: str) -> set[str]:
    allow: set[str] = set()
    for prefix, methods in PUBLIC_RULES:
        if path.startswith(prefix):
            allow |= methods
    # ⬇️ allow GET/OPTIONS for the has-purchase probe from custom domains
    if _is_has_purchase(path):
        allow |= {"GET", "OPTIONS"}
    return allow

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import Response

class DynamicSaaSCORSMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request, call_next):
        origin = request.headers.get("origin")
        path = request.url.path
        method = request.method.upper()

        # Known dashboard/admin origins -> let global CORSMiddleware handle (cookies allowed)
        if origin and origin in ALLOWED_ORIGINS:
            return await call_next(request)

        allowed = _allowed_methods_for(path)

        # Preflight: be permissive even if Access-Control-Request-Method header is missing
        if method == "OPTIONS" and allowed:
            acrh = request.headers.get("access-control-request-headers", "content-type")
            return Response(
                status_code=204,
                headers={
                    "Access-Control-Allow-Origin": origin or "*",
                    "Vary": "Origin",
                    "Access-Control-Allow-Methods": ",".join(sorted(allowed)),
                    "Access-Control-Allow-Headers": acrh or "content-type",
                    "Access-Control-Max-Age": "86400",
                    # No Allow-Credentials for unknown origins
                },
            )

        # Actual request from unknown origins to public paths
        if allowed and method in allowed:
            resp = await call_next(request)
            resp.headers["Access-Control-Allow-Origin"] = origin or "*"
            resp.headers["Vary"] = "Origin"
            return resp

        return await call_next(request)

# app.add_middleware(
#     CORSMiddleware,
#     allow_origins=ALLOWED_ORIGINS or ["http://localhost:3000"],
#     allow_credentials=True,
#     allow_methods=["*"],
#     allow_headers=["*"],
# )
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS or ["http://localhost:3000"],
    allow_origin_regex=r"https://.*", # ✅ FIX 2: THE MAGIC WILDCARD!
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(DynamicSaaSCORSMiddleware)

# ---- Static files (keep only if the folder exists in the container)
if os.path.isdir("static"):
    app.mount("/static", StaticFiles(directory="static"), name="static")

# ---- Routers
app.include_router(auth_router)
app.include_router(restaurants_router)
app.include_router(locations_router)
app.include_router(menus_router)
app.include_router(extras_router)
app.include_router(menu_item_extrasRouter)
app.include_router(options_grounpRouter)
app.include_router(optionschoices)
app.include_router(menuitemoptions)
app.include_router(schedulesrouter)
app.include_router(paymentRouter)
app.include_router(websiteBuilderRouter)
app.include_router(uploads_router)
app.include_router(ai_router)
app.include_router(site_auth_router)
app.include_router(site_member_payments_router)
app.include_router(custom_domains_router)
app.include_router(public_router)
app.include_router(checkout_router)
app.include_router(webhooks_router) # ✅ ADD THIS
app.include_router(orders_router) # ✅ ADD THIS
app.include_router(custom_data_router) # ✅ ADD THIS
app.include_router(zygo_router, prefix="/zygo", tags=["zygoflow"])  # ✅ ZYGOFLOW


# ---- Health check
@app.get("/health")
def health():
    return {"ok": True}


