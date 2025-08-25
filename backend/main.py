# main.py
import os
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import Response

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
origins_env = os.getenv("FRONTEND_ORIGIN", "")
ALLOWED_ORIGINS = [o.strip() for o in origins_env.split(",") if o.strip()]

app = FastAPI()

PUBLIC_RULES = [
    # site-member auth (needs POST from custom domains)
    ("/site-auth/", {"GET", "POST", "OPTIONS"}),

    # checkout from custom domains (your endpoint is /users-stripe-account/public/...)
    ("/users-stripe-account/public/", {"POST", "OPTIONS"}),

    # read-only public data
    ("/public/", {"GET", "OPTIONS"}),
    ("/locations/", {"GET", "OPTIONS"}),
    ("/menu-item-extras/", {"GET", "OPTIONS"}),   # GET only for custom domains
    ("/menu-item-options/", {"GET", "OPTIONS"}),  # GET only for custom domains
    ("/uploads/", {"GET", "OPTIONS"}),
]

def _allowed_methods_for(path: str) -> set[str]:
    allow: set[str] = set()
    for prefix, methods in PUBLIC_RULES:
        if path.startswith(prefix):
            allow |= methods
    return allow

class DynamicSaaSCORSMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request, call_next):
        origin = request.headers.get("origin")
        path = request.url.path
        method = request.method.upper()

        # 1) Known dashboard/frontends -> handled by global CORSMiddleware (cookies allowed)
        if origin and origin in ALLOWED_ORIGINS:
            return await call_next(request)

        # 2) Unknown origins (custom domains, other sites) -> allow only per PUBLIC_RULES and never cookies
        allowed = _allowed_methods_for(path)

        # Preflight
        if method == "OPTIONS":
            req_method = request.headers.get("access-control-request-method", "").upper()
            if req_method and req_method in allowed:
                acrh = request.headers.get("access-control-request-headers", "content-type")
                return Response(
                    status_code=204,
                    headers={
                        "Access-Control-Allow-Origin": origin or "*",
                        "Vary": "Origin",
                        "Access-Control-Allow-Methods": ",".join(sorted(allowed)),
                        "Access-Control-Allow-Headers": acrh,
                        "Access-Control-Max-Age": "86400",
                        # NOTE: do NOT send Access-Control-Allow-Credentials for unknown origins
                    },
                )
            # not an allowed preflight -> fall through to app (will likely 405)

        # Actual request
        if method in allowed:
            resp = await call_next(request)
            resp.headers["Access-Control-Allow-Origin"] = origin or "*"
            resp.headers["Vary"] = "Origin"
            # no Access-Control-Allow-Credentials for unknown origins
            return resp

        # 3) Everything else -> normal app + global CORS
        return await call_next(request)
app.add_middleware(DynamicSaaSCORSMiddleware)

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS or ["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


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


# ---- Health check
@app.get("/health")
def health():
    return {"ok": True}

@app.on_event("startup")
async def on_startup():
    await init_db()
