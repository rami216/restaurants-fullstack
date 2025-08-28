# Create a new file: website_builder/stripe_checkout_router.py

import json
import stripe
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from uuid import UUID

from database import get_db
from models import User, MenuItem, WebsiteOrder, Location, RestaurantOwner # Make sure all models are imported
from auth.auth_handler import get_current_active_user
from website_builder.site_commerce_models import WebsiteStripeAccount

router = APIRouter(prefix="/checkout", tags=["Stripe Cart Checkout"])

# --- Helper to get Stripe API Key ---
async def get_stripe_key(website_id: UUID, db: AsyncSession) -> str:
    secret_key = await db.scalar(
        select(WebsiteStripeAccount.stripe_secret_key)
        .where(WebsiteStripeAccount.website_id == website_id)
    )
    if not secret_key:
        raise HTTPException(status_code=400, detail="Stripe is not configured for this website.")
    return secret_key

# --- DTOs (Data Transfer Objects) ---
class CartItem(BaseModel):
    # This must exactly match the frontend CartItem interface in CartContext.tsx
    cartItemId: str
    itemId: str # This should be a UUID, Pydantic will convert the string
    name: str
    unitPrice: float # ✅ FIX: Changed from basePrice to unitPrice
    quantity: int
    imageUrl: str | None = None
    selectedExtras: list = []
    selectedOptions: dict = {}

class CheckoutPayload(BaseModel):
    cart: list[CartItem]
    website_id: UUID

# --- Endpoint to sync a menu item with Stripe ---
@router.post("/sync-product/{item_id}")
async def sync_menu_item_with_stripe(
    item_id: UUID, 
    db: AsyncSession = Depends(get_db), 
    current_user: User = Depends(get_current_active_user)
):
    # This first query is correct and well-optimized
    result = await db.execute(
        select(MenuItem)
        .options(selectinload(MenuItem.location).selectinload(Location.restaurant))
        .where(MenuItem.item_id == item_id)
    )
    menu_item = result.scalars().first()

    if not menu_item:
        raise HTTPException(status_code=404, detail="Menu item not found.")
    
    # Ownership Check
    if not menu_item.location or not menu_item.location.restaurant:
        raise HTTPException(status_code=404, detail="Menu item is not linked to a restaurant owner.")
    
    if menu_item.location.restaurant.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="You do not own this menu item.")

    # Get the owner object from the already loaded relationship
    owner = menu_item.location.restaurant
    
    # ✅ FIX: Eagerly load the 'website' relationship for the owner object.
    # We must do this before accessing owner.website.
    await db.refresh(owner, attribute_names=["website"])
    
    if not owner.website:
         raise HTTPException(status_code=404, detail="Website not found for this item's owner.")
    
    stripe.api_key = await get_stripe_key(owner.website.website_id, db)
    
    try:
        # ... (the rest of your Stripe logic remains the same)
        if menu_item.stripe_product_id:
            product = stripe.Product.modify(menu_item.stripe_product_id, name=menu_item.item_name)
            if menu_item.stripe_price_id:
                stripe.Price.modify(menu_item.stripe_price_id, active=False)
            
            new_price = stripe.Price.create(
                product=product.id,
                unit_amount=int(float(menu_item.base_price) * 100),
                currency="usd",
            )
            menu_item.stripe_price_id = new_price.id
        else:
            product = stripe.Product.create(name=menu_item.item_name)
            price = stripe.Price.create(
                product=product.id,
                unit_amount=int(float(menu_item.base_price) * 100),
                currency="usd",
            )
            menu_item.stripe_product_id = product.id
            menu_item.stripe_price_id = price.id
        
        menu_item.is_shippable = True
        await db.commit()
        
        return {"stripe_product_id": product.id, "stripe_price_id": price.id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Stripe API error: {str(e)}")


# --- Endpoint to create a Payment Intent for the cart ---
@router.post("/create-payment-intent")
async def create_payment_intent(payload: CheckoutPayload, db: AsyncSession = Depends(get_db)):
    stripe.api_key = await get_stripe_key(payload.website_id, db)
    
    total = 0
    for item in payload.cart:
        db_item = await db.get(MenuItem, item.itemId)
        if not db_item:
            raise HTTPException(status_code=404, detail=f"Item {item.name} not found.")
        
        # ✅ FIX: Use the corrected field name here as well
        total += item.unitPrice * item.quantity

    if total <= 0:
        raise HTTPException(status_code=400, detail="Cart total must be zero.")

    try:
        payment_intent = stripe.PaymentIntent.create(
            amount=int(total * 100),
            currency="usd",
            automatic_payment_methods={"enabled": True},
            metadata={
                "type": "cart_checkout",
                "website_id": str(payload.website_id),
                "cart_items": json.dumps([item.model_dump(mode='json') for item in payload.cart])
            }
        )
        return {"clientSecret": payment_intent.client_secret}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
