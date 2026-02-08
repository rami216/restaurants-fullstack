# Create a new file: website_builder/stripe_checkout_router.py

import json
import stripe
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from uuid import UUID
from decimal import Decimal # ✅ 1. Import the Decimal type
from database import get_db
from models import User, MenuItem, WebsiteOrder, Location, RestaurantOwner,WebsiteEmailConfig # Make sure all models are imported
from auth.auth_handler import get_current_active_user
from website_builder.site_commerce_models import WebsiteStripeAccount
import httpx # <--- Added for SendGrid
import smtplib # <--- Added for SMTP
from email.mime.text import MIMEText # <--- Added
from email.mime.multipart import MIMEMultipart # <--- Added
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
    # This now perfectly matches your frontend CartItem interface
    cartItemId: str
    itemId: str  # Receive as a string
    name: str
    unitPrice: float
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

@router.post("/unsync-product/{item_id}")
async def unsync_menu_item_from_stripe(
    item_id: UUID, 
    db: AsyncSession = Depends(get_db), 
    current_user: User = Depends(get_current_active_user)
):
    # Fetch the menu item with all its relationships
    result = await db.execute(
        select(MenuItem)
        .options(selectinload(MenuItem.location).selectinload(Location.restaurant))
        .where(MenuItem.item_id == item_id)
    )
    menu_item = result.scalars().first()

    if not menu_item:
        raise HTTPException(status_code=404, detail="Menu item not found.")
    
    # Ownership Check
    if not menu_item.location or not menu_item.location.restaurant or menu_item.location.restaurant.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="You do not own this menu item.")

    # Deactivate the product in Stripe
    if menu_item.stripe_product_id:
        try:
            owner = menu_item.location.restaurant
            await db.refresh(owner, attribute_names=["website"])
            if not owner.website:
                raise HTTPException(status_code=404, detail="Website not found for this item's owner.")
            
            stripe.api_key = await get_stripe_key(owner.website.website_id, db)

            # Deactivating the price is often sufficient
            if menu_item.stripe_price_id:
                stripe.Price.modify(menu_item.stripe_price_id, active=False)
            
            # You can also deactivate the product itself
            stripe.Product.modify(menu_item.stripe_product_id, active=False)

        except Exception as e:
            # Don't block the UI if Stripe fails, just log it
            print(f"Could not deactivate Stripe product {menu_item.stripe_product_id}. Error: {e}")

    # Update your database
    menu_item.is_shippable = False
    menu_item.stripe_product_id = None
    menu_item.stripe_price_id = None
    await db.commit()
    
    return {"status": "un-synced successfully"}

# --- Endpoint to create a Payment Intent for the cart ---
@router.post("/create-payment-intent")
async def create_payment_intent(payload: CheckoutPayload, db: AsyncSession = Depends(get_db)):
    stripe.api_key = await get_stripe_key(payload.website_id, db)
    
    total = 0
    # ✅ 1. Create a simplified list for the metadata
    simplified_cart_for_metadata = []

    for item in payload.cart:
        try:
            item_uuid = UUID(item.itemId)
        except ValueError:
            raise HTTPException(status_code=400, detail=f"Invalid itemId format for {item.name}.")

        db_item = await db.get(MenuItem, item_uuid)
        if not db_item:
            raise HTTPException(status_code=404, detail=f"Item {item.name} not found.")
        
        # We'll trust the client's calculated price for now
        total += item.unitPrice * item.quantity

        # ✅ 2. Build the simplified object for metadata
        simplified_item = {
            "itemId": item.itemId,
            "quantity": item.quantity,
            "selectedExtras": [extra.get("extra_id") for extra in item.selectedExtras],
            "selectedOptions": item.selectedOptions
        }
        simplified_cart_for_metadata.append(simplified_item)


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
                # ✅ 3. Save the simplified, shorter version to metadata
                "cart_items": json.dumps(simplified_cart_for_metadata)
            }
        )
        return {"clientSecret": payment_intent.client_secret}
    except Exception as e:
        print(f"Stripe Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


class OrderPayload(BaseModel):
    cart: list[CartItem]
    website_id: UUID
    customer_name: str
    customer_email: str
    customer_phone: str | None = None
    shipping_address: str

@router.post("/submit-cod-order")
async def submit_cod_order(payload: OrderPayload, db: AsyncSession = Depends(get_db)):
    new_order = WebsiteOrder(
        website_id=payload.website_id,
        customer_name=payload.customer_name,
        customer_email=payload.customer_email,
        customer_phone=payload.customer_phone,
        shipping_address=payload.shipping_address,
        cart_items=[item.model_dump() for item in payload.cart],
        total_amount_cents=int(sum(item.unitPrice * item.quantity for item in payload.cart) * 100),
        currency="usd",
        payment_intent_id=None,
        status="pending",
    )
    db.add(new_order)
    await db.commit()
    
    # 2. Send Order Confirmation Email
    try:
        email_config = await db.scalar(select(WebsiteEmailConfig).where(WebsiteEmailConfig.website_id == payload.website_id))
        
        if email_config:
            # Build the Item List HTML
            items_html = ""
            for item in payload.cart:
                # Format options text
                options_text = ""
                if item.selectedOptions:
                    options_text = "<br><small>" + ", ".join([f"{k}: {v}" for k,v in item.selectedOptions.items()]) + "</small>"
                
                items_html += f"""
                <tr style="border-bottom: 1px solid #eee;">
                    <td style="padding: 10px;">{item.name} x {item.quantity}{options_text}</td>
                    <td style="padding: 10px; text-align: right;">${(item.unitPrice * item.quantity):.2f}</td>
                </tr>
                """

            total_price = sum(item.unitPrice * item.quantity for item in payload.cart)
            
            subject = f"Order Confirmation #{str(new_order.order_id)[:8]}"
            
            body = f"""
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 8px;">
                <h2 style="color: #333;">Thank you for your order, {payload.customer_name}!</h2>
                <p>We have received your Cash on Delivery order.</p>
                
                <h3>Order Summary</h3>
                <table style="width: 100%; border-collapse: collapse;">
                    {items_html}
                    <tr>
                        <td style="padding: 15px 10px; font-weight: bold;">Total</td>
                        <td style="padding: 15px 10px; text-align: right; font-weight: bold;">${total_price:.2f}</td>
                    </tr>
                </table>

                <div style="background-color: #f9f9f9; padding: 15px; margin-top: 20px; border-radius: 5px;">
                    <strong>Shipping to:</strong><br>
                    {payload.shipping_address}<br>
                    {payload.customer_phone or ""}
                </div>
                
                <p style="margin-top: 20px; font-size: 12px; color: #888;">
                    This email was sent from {email_config.from_name}.
                </p>
            </div>
            """

            # --- SEND VIA SENDGRID ---
            if email_config.provider_type == "sendgrid" and email_config.sendgrid_api_key:
                async with httpx.AsyncClient() as client:
                    await client.post(
                        "https://api.sendgrid.com/v3/mail/send",
                        headers={"Authorization": f"Bearer {email_config.sendgrid_api_key}", "Content-Type": "application/json"},
                        json={
                            "personalizations": [{"to": [{"email": payload.customer_email}]}],
                            "from": {"email": email_config.from_email, "name": email_config.from_name},
                            "subject": subject,
                            "content": [{"type": "text/html", "value": body}]
                        }
                    )
            
            # --- SEND VIA SMTP ---
            elif email_config.provider_type == "smtp":
                message = MIMEMultipart()
                message["From"] = f"{email_config.from_name} <{email_config.from_email}>"
                message["To"] = payload.customer_email
                message["Subject"] = subject
                message.attach(MIMEText(body, "html"))

                timeout = 10
                if email_config.smtp_port == 465:
                    server = smtplib.SMTP_SSL(email_config.smtp_host, email_config.smtp_port, timeout=timeout)
                else:
                    server = smtplib.SMTP(email_config.smtp_host, email_config.smtp_port, timeout=timeout)
                    server.ehlo()
                    if server.has_extn("STARTTLS"):
                        server.starttls()
                        server.ehlo()
                server.login(email_config.smtp_user, email_config.smtp_password)
                server.sendmail(email_config.from_email, payload.customer_email, message.as_string())
                server.quit()

    except Exception as e:
        print(f"Order email failed but order saved: {e}")

    return {"status": "success", "order_id": new_order.order_id}
