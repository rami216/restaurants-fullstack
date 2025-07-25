# main.py
from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from database import init_db
from auth.router import router as auth_router
from restaurants.router import router as restaurants_router
from locations.router import router as locations_router
from menu_items.router import router as menus_router
from extras.router import router as extras_router
from menu_item_extras.router import router as menu_item_extrasRouter
from option_groups.router import router  as options_grounpRouter
from option_choices.router import router as optionschoices
from menu_item_options.router import router as menuitemoptions
from schedules.router import router as schedulesrouter
from payments.router import router as paymentRouter
from website_builder.router import router as websiteBuilderRouter
from uploads.router import router as uploads_router # Import the new router
from fastapi.staticfiles import StaticFiles # Import StaticFiles
from ai.router import router as ai_router
app = FastAPI()

origins = [
    "http://localhost:3000",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.mount("/static", StaticFiles(directory="static"), name="static")

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

@app.on_event("startup")
async def on_startup():
    await init_db()
