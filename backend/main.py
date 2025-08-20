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

# --- Dynamic CORS only for SaaS/public endpoints (no cookies there) ---
SaaS_CORS_PATH_PREFIXES = (
    "/site-auth/",                # site member login/register/me
    "/users-stripe-account/",     # (if you call this directly from client sites)
    "/public/",                   # any public resolver you expose
)
class DynamicSaaSCORSMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        path = request.url.path

        if path.startswith(SaaS_CORS_PATH_PREFIXES):
            origin = request.headers.get("origin")
            # Preflight
            if request.method == "OPTIONS":
                acrh = request.headers.get("access-control-request-headers", "*")
                headers = {
                    "Access-Control-Allow-Origin": origin or "*",
                    "Vary": "Origin",
                    "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
                    "Access-Control-Allow-Headers": acrh,
                    "Access-Control-Max-Age": "86400",
                    # site-member flows do NOT use cookies:
                    "Access-Control-Allow-Credentials": "false",
                }
                return Response(status_code=204, headers=headers)

            # Actual request
            response = await call_next(request)
            if origin:
                response.headers["Access-Control-Allow-Origin"] = origin
                response.headers["Vary"] = "Origin"
                # no cookies for these endpoints:
                response.headers["Access-Control-Allow-Credentials"] = "false"
            response.headers["X-Dynamic-CORS"] = "1"   # <- debug
            return response

        # Not a SaaS public endpoint → let normal pipeline handle it
        return await call_next(request)

# Register dynamic middleware FIRST so it runs before the global CORS


app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS or ["http://localhost:3000"],
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


# ---- Health check
@app.get("/health")
def health():
    return {"ok": True}

@app.on_event("startup")
async def on_startup():
    await init_db()
