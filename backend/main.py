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
    ("/site-auth/", {"GET", "POST", "OPTIONS"}),                # login/register
    ("/users-stripe-account/public/", {"POST", "OPTIONS"}),     # checkout
    ("/public/", {"GET", "OPTIONS"}),
    ("/locations/", {"GET", "OPTIONS"}),
    ("/menu-item-extras/", {"GET", "OPTIONS"}),
    ("/menu-item-options/", {"GET", "OPTIONS"}),
    ("/uploads/", {"GET", "OPTIONS"}),
]

def _allowed_methods_for(path: str) -> set[str]:
    allowed: set[str] = set()
    for prefix, methods in PUBLIC_RULES:
        if path.startswith(prefix):
            allowed |= methods
    return allowed

SAFE_DEFAULT_HEADERS = "content-type, authorization"

class DynamicSaaSCORSMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request, call_next):
        origin = request.headers.get("origin")
        path = request.url.path
        method = request.method.upper()

        # Known dashboard/frontends -> handled later by global CORSMiddleware (cookies allowed)
        if origin and origin in ALLOWED_ORIGINS:
            return await call_next(request)

        # Unknown origins (custom domains) -> path/method based CORS (no cookies)
        allowed = _allowed_methods_for(path)

        if method == "OPTIONS" and allowed:
            # Be permissive: reply even if Access-Control-Request-Method header is absent
            acrm = request.headers.get("access-control-request-method", "").upper()
            acrh = request.headers.get("access-control-request-headers", SAFE_DEFAULT_HEADERS)
            return Response(
                status_code=204,
                headers={
                    "Access-Control-Allow-Origin": origin or "*",
                    "Vary": "Origin",
                    "Access-Control-Allow-Methods": ",".join(sorted(allowed)),
                    "Access-Control-Allow-Headers": acrh or SAFE_DEFAULT_HEADERS,
                    "Access-Control-Max-Age": "86400",
                    # DO NOT include Allow-Credentials for unknown origins
                },
            )

        if allowed and method in allowed:
            resp = await call_next(request)
            resp.headers["Access-Control-Allow-Origin"] = origin or "*"
            resp.headers["Vary"] = "Origin"
            # no Allow-Credentials for unknown origins
            return resp

        # Everything else -> normal app + global CORSMiddleware (cookie routes)
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
