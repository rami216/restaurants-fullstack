#website_builder/site_members_payments/router.py
import stripe
import json
from uuid import UUID
import traceback
from fastapi import APIRouter, Depends, HTTPException, Header, Request
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from database import get_db
from config import get_app_url
from website_builder.site_auth_router import site_member_required
from website_builder.site_commerce_models import WebsiteStripeAccount,SitePurchase,SiteProduct
from website_builder.models import Website
from auth.auth_handler import get_current_active_user as get_current_user
from models import RestaurantOwner, WebsiteOrder # ✅ 1. IMPORT WebsiteOrder
import httpx # <--- Add this
import smtplib # <--- Add this
from email.mime.text import MIMEText # <--- Add this
from email.mime.multipart import MIMEMultipart # <--- Add this
from website_builder.models import WebsiteEmailConfig
router = APIRouter(prefix="/users-stripe-account", tags=["SiteMemberPayments"])

# =========================
# DTOs
# =========================
class StripeConfigDTO(BaseModel):
    stripe_secret_key: str
    stripe_webhook_secret: str
    stripe_publishable_key:str

class CheckoutDTO(BaseModel):
    price_id: str          # Stripe Price ID
    product_id: str        # ← YOUR DB product_id (UUID) for gating
    
    
def _get_owned_website_stmt(website_id: str, user_id: int):
    # Website.restaurant_id -> RestaurantOwner.restaurant_id -> RestaurantOwner.user_id
    return (
        select(Website)
        .join(RestaurantOwner, Website.restaurant_id == RestaurantOwner.restaurant_id)
        .where(
            Website.website_id == website_id,
            RestaurantOwner.user_id == user_id,
        )
        .limit(1)
    )

@router.get("/public/stripe-key/{website_id}")
async def get_public_stripe_key(website_id: str, db: AsyncSession = Depends(get_db)):
    """
    Safely provides the public Stripe key for a given website.
    This is a public endpoint and does not require authentication.
    """
    publishable_key = await db.scalar(
        select(WebsiteStripeAccount.stripe_publishable_key)
        .where(WebsiteStripeAccount.website_id == website_id)
    )
    
    if not publishable_key:
        raise HTTPException(status_code=404, detail="Stripe publishable key not found for this site.")
    
    return {"publishableKey": publishable_key}

# =========================
# Save Stripe Config (Self-service)
# =========================
@router.post("/builder/websites/{website_id}/stripe-config")
async def save_stripe_config_owner(
    website_id: str,
    body: StripeConfigDTO,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user),
):
    website = await db.scalar(_get_owned_website_stmt(website_id, current_user.id))
    if not website:
        raise HTTPException(403, "You do not own this website.")

    row = await db.scalar(
        select(WebsiteStripeAccount).where(WebsiteStripeAccount.website_id == website_id)
    )
    if row:
        row.stripe_secret_key = body.stripe_secret_key
        row.stripe_webhook_secret = body.stripe_webhook_secret
        row.stripe_publishable_key = body.stripe_publishable_key 
    else:
        db.add(
            WebsiteStripeAccount(
                website_id=website_id,
                stripe_secret_key=body.stripe_secret_key,
                stripe_webhook_secret=body.stripe_webhook_secret,
                stripe_publishable_key=body.stripe_publishable_key
            )
        )
    await db.commit()
    return {"status": "saved"}

# =========================
# Create Checkout Session
# =========================
@router.post("/public/websites/{website_id}/checkout")
async def create_checkout_session(
    website_id: str,
    body: dict,
    db: AsyncSession = Depends(get_db),
):
    product_id = body.get("product_id")
    member_id  = body.get("member_id")
    # ✅ Capture the action (purchase or subscribe) from the frontend
    action = body.get("action", "purchase") 
    
    success_url = body.get("success_url") or "https://example.com/success"
    cancel_url  = body.get("cancel_url")  or "https://example.com/cancel"

    if not product_id:
        raise HTTPException(400, "product_id required")

    product = await db.scalar(
        select(SiteProduct).where(
            SiteProduct.product_id == product_id,
            SiteProduct.website_id == website_id
        )
    )
    if not product:
        raise HTTPException(404, "Product not found")

    secret_key = await db.scalar(
        select(WebsiteStripeAccount.stripe_secret_key)
        .where(WebsiteStripeAccount.website_id == website_id)
    )
    if not secret_key:
        raise HTTPException(400, "Stripe not configured")

    stripe.api_key = secret_key

    # ✅ LOGIC SWITCH: Determine Stripe Mode and Metadata based on 'action'
    is_subscription = action == "subscribe"
    mode = "subscription" if is_subscription else "payment"
    metadata_type = "site_member_subscription" if is_subscription else "site_member_unlock"

    checkout_params = {
        "mode": mode,
        "payment_method_types": ["card"],
        "line_items": [{"price": product.stripe_price_id, "quantity": 1}],
        "success_url": success_url,
        "cancel_url": cancel_url,
    }

    # ✅ IMPORTANT: Metadata location differs slightly between modes
    shared_metadata = {
        "type": metadata_type,
        "website_id": website_id,
        "member_id": member_id or "",
        "product_id": product_id,
    }

    if is_subscription:
        checkout_params["subscription_data"] = {"metadata": shared_metadata}
    else:
        checkout_params["metadata"] = shared_metadata

    session = stripe.checkout.Session.create(**checkout_params)

    return {"checkout_url": session.url}

# =========================
# Create Subscription Checkout
# =========================
@router.post("/public/websites/{website_id}/subscription-checkout")
async def create_subscription_checkout(
    website_id: str,
    body: dict,
    db: AsyncSession = Depends(get_db),
):
    product_id = body.get("product_id")
    member_id  = body.get("member_id")
    success_url = body.get("success_url") or "https://example.com/success"
    cancel_url  = body.get("cancel_url")  or "https://example.com/cancel"

    if not product_id:
        raise HTTPException(400, "product_id required")

    product = await db.scalar(
        select(SiteProduct).where(
            SiteProduct.product_id == product_id,
            SiteProduct.website_id == website_id
        )
    )
    if not product:
        raise HTTPException(404, "Product not found")

    secret_key = await db.scalar(
        select(WebsiteStripeAccount.stripe_secret_key)
        .where(WebsiteStripeAccount.website_id == website_id)
    )
    if not secret_key:
        raise HTTPException(400, "Stripe not configured")

    stripe.api_key = secret_key

    # CRITICAL DIFFERENCE: mode="subscription"
    session = stripe.checkout.Session.create(
        mode="subscription",
        payment_method_types=["card"],
        line_items=[{"price": product.stripe_price_id, "quantity": 1}],
        success_url=success_url,
        cancel_url=cancel_url,
        subscription_data={
            "metadata": {
                "type": "site_member_subscription",
                "website_id": website_id,
                "member_id": member_id or "",
                "product_id": product_id,
            }
        },
    )

    return {"checkout_url": session.url}
@router.post("/webhook")
async def webhook(
    request: Request,
    db: AsyncSession = Depends(get_db),
    stripe_signature: str | None = Header(None, alias="Stripe-Signature"),
):
    payload = await request.body()

    # 1. Parse Website ID safely
    try:
        raw = json.loads(payload)
        md = raw.get("data", {}).get("object", {}).get("metadata", {}) or {}
        website_id_str = md.get("website_id")
    except Exception:
        return {"status": "ignored (payload parsing failed)"}

    if not website_id_str:
        return {"status": "ignored (no website_id in metadata)"}

    # 2. Get Secret
    account = await db.scalar(
        select(WebsiteStripeAccount).where(WebsiteStripeAccount.website_id == website_id_str)
    )
    if not account or not account.stripe_webhook_secret:
        return {"status": "ignored (no website webhook secret configured)"}

    # 3. Verify Signature
    try:
        event = stripe.Webhook.construct_event(
            payload=payload,
            sig_header=stripe_signature,
            secret=account.stripe_webhook_secret,
        )
    except Exception as e:
        print(f"❌ Webhook Signature Error: {e}")
        raise HTTPException(400, f"Webhook verification failed: {e}")

    # --- Handle Events ---

    # ✅ FIX: Unified handler for both One-time and Subscriptions
    if event["type"] == "checkout.session.completed":
        session = event["data"]["object"]
        
        if session.get("payment_status") != "paid":
            return {"status": "ignored (not paid)"}

        # 1. Try to get metadata from the session (One-time)
        md = session.get("metadata") or {}
        
        # 2. If it's a subscription, metadata moved to the Subscription object
        if not md.get("type") and session.get("subscription"):
            stripe.api_key = account.stripe_secret_key
            subscription_obj = stripe.Subscription.retrieve(session.get("subscription"))
            md = subscription_obj.get("metadata") or {}

        # 3. Process if it matches our unlock types
        if md.get("type") in ["site_member_unlock", "site_member_subscription"]:
            try:
                website_id = md.get("website_id")
                member_id = md.get("member_id")
                product_id = md.get("product_id")
                
                # Use Sub ID for recurring, PaymentIntent ID for one-time
                payment_intent_id = session.get("subscription") or session.get("payment_intent")
                
                amount_total = session.get("amount_total", 0)
                currency = session.get("currency", "usd")

                if not (website_id and member_id and product_id and payment_intent_id):
                    print("⚠️ Webhook missing critical metadata values")
                    return {"status": "ignored (missing metadata)"}
                
                # Check for existing to prevent duplicate rows
                existing = await db.scalar(
                    select(SitePurchase).where(SitePurchase.payment_intent_id == payment_intent_id)
                )
                
                if not existing:
                    db.add(SitePurchase(
                        website_id=UUID(website_id),
                        member_id=UUID(member_id),
                        product_id=UUID(product_id),
                        status="active" if md.get("type") == "site_member_subscription" else "paid",
                        payment_intent_id=payment_intent_id,
                        amount_paid=amount_total / 100.0,
                        currency=currency
                    ))
                    await db.commit()
                    print(f"✅ SUCCESS: Unlocked {product_id} for member {member_id}")
            except Exception as e:
                print(f"❌ Database Error in Webhook: {e}")
                traceback.print_exc()
                return {"status": "error", "message": str(e)}
    # ✅ CASE 2: CART CHECKOUT (Physical/Menu Items) WITH EMAIL
    elif event["type"] == "payment_intent.succeeded":
        payment_intent = event["data"]["object"]
        md = payment_intent.get("metadata", {})

        if md.get("type") == "cart_checkout":
            try:
                website_id = md.get("website_id")
                
                shipping_details = payment_intent.get("shipping")
                customer_name = shipping_details.get("name") if shipping_details else "N/A"
                customer_email = payment_intent.get("receipt_email")
                customer_phone = shipping_details.get("phone") if shipping_details else None
                
                address_details = shipping_details.get("address", {}) if shipping_details else {}
                address_parts = [
                    address_details.get("line1"),
                    address_details.get("city"),
                    address_details.get("state"),
                    address_details.get("postal_code"),
                    address_details.get("country"),
                ]
                shipping_address = ", ".join(filter(None, address_parts))

                # ✅ FIX 3: Find the pending order we created earlier and UPDATE it!
                existing_order = await db.scalar(select(WebsiteOrder).where(WebsiteOrder.payment_intent_id == payment_intent.get("id")))
                
                if existing_order:
                    existing_order.customer_name = customer_name
                    existing_order.customer_email = customer_email
                    existing_order.customer_phone = customer_phone
                    existing_order.shipping_address = shipping_address
                    existing_order.status = "paid"
                    await db.commit()
                    
                    # 📧 SEND CONFIRMATION EMAIL
                    try:
                        email_config = await db.scalar(select(WebsiteEmailConfig).where(WebsiteEmailConfig.website_id == UUID(website_id)))
                        if email_config and customer_email:
                            subject = f"Order Paid #{str(existing_order.order_id)[:8]}"
                            total_paid = (payment_intent.get("amount") / 100)

                            # Build the Item List HTML for the email
                            items_html = ""
                            for item_dict in existing_order.cart_items:
                                item_name = item_dict.get("item_name", "Item")
                                qty = item_dict.get("quantity", 1)
                                price = item_dict.get("price", 0)
                                options_text = ""
                                if item_dict.get("selectedOptions"):
                                    options_text = "<br><small>" + ", ".join([f"{k}: {v}" for k,v in item_dict["selectedOptions"].items()]) + "</small>"
                                
                                items_html += f"""
                                <tr style="border-bottom: 1px solid #eee;">
                                    <td style="padding: 10px;">{item_name} x {qty}{options_text}</td>
                                    <td style="padding: 10px; text-align: right;">${(price * qty):.2f}</td>
                                </tr>
                                """
                            
                            body = f"""
                            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 8px;">
                                <h2 style="color: #28a745;">Payment Successful!</h2>
                                <p>Hi {customer_name},</p>
                                <p>We have received your payment of <b>${total_paid:.2f}</b>.</p>
                                
                                <h3>Order Summary</h3>
                                <table style="width: 100%; border-collapse: collapse;">
                                    {items_html}
                                    <tr>
                                        <td style="padding: 15px 10px; font-weight: bold;">Total Paid</td>
                                        <td style="padding: 15px 10px; text-align: right; font-weight: bold;">${total_paid:.2f}</td>
                                    </tr>
                                </table>

                                <div style="background-color: #f9f9f9; padding: 15px; margin-top: 20px; border-radius: 5px;">
                                    <strong>Shipping to:</strong><br>
                                    {shipping_address}<br>
                                    {customer_phone or ""}
                                </div>
                                
                                <p style="margin-top: 20px; font-size: 12px; color: #888;">
                                    Sent by {email_config.from_name}
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
                                            "personalizations": [{"to": [{"email": customer_email}]}],
                                            "from": {"email": email_config.from_email, "name": email_config.from_name},
                                            "subject": subject,
                                            "content": [{"type": "text/html", "value": body}]
                                        }
                                    )
                            # --- SEND VIA SMTP ---
                            elif email_config.provider_type == "smtp":
                                message = MIMEMultipart()
                                message["From"] = f"{email_config.from_name} <{email_config.from_email}>"
                                message["To"] = customer_email
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
                                server.sendmail(email_config.from_email, customer_email, message.as_string())
                                server.quit()

                    except Exception as email_err:
                        print(f"⚠️ Email failed for Stripe order: {email_err}")

            except Exception as e:
                print(f"❌ Database Insert Error (Cart): {e}")
                traceback.print_exc()
                return {"status": "error", "message": str(e)}
    # ✅ CASE 3: SUBSCRIPTION CREATED / RENEWED (Invoice Paid)
   
    elif event["type"] == "invoice.payment_succeeded":
        invoice = event["data"]["object"]
        
        if invoice.get("subscription"):
            subscription_id = invoice.get("subscription")
            
            stripe.api_key = account.stripe_secret_key
            sub = stripe.Subscription.retrieve(subscription_id)
            md = sub.get("metadata", {})
            
            # Use the type we set in the checkout session
            if md.get("type") == "site_member_subscription":
                try:
                    website_id = md.get("website_id")
                    member_id = md.get("member_id")
                    product_id = md.get("product_id")
                    
                    amount_paid = invoice.get("amount_paid", 0) / 100.0
                    currency = invoice.get("currency", "eur")

                    # Logic Fix: Check if this user already has an entry for THIS product
                    existing = await db.scalar(
                        select(SitePurchase).where(
                            SitePurchase.website_id == UUID(website_id),
                            SitePurchase.member_id == UUID(member_id),
                            SitePurchase.product_id == UUID(product_id)
                        )
                    )
                    
                    if not existing:
                        # CREATE the purchase record so the visibility logic works!
                        db.add(SitePurchase(
                            website_id=UUID(website_id),
                            member_id=UUID(member_id),
                            product_id=UUID(product_id),
                            status="active",
                            payment_intent_id=subscription_id, # Link to Sub ID
                            amount_paid=amount_paid,
                            currency=currency
                        ))
                    else:
                        existing.status = "active"
                        existing.payment_intent_id = subscription_id
                    
                    await db.commit()
                except Exception as e:
                    print(f"❌ Database Insert Error (Subscription): {e}")
    # ✅ CASE 4: SUBSCRIPTION CANCELLED OR FAILED
    elif event["type"] in ["customer.subscription.deleted", "customer.subscription.canceled"]:
        sub = event["data"]["object"]
        subscription_id = sub.get("id")
        
        try:
            # Find the active subscription in the database and revoke access
            existing = await db.scalar(
                select(SitePurchase).where(
                    SitePurchase.payment_intent_id == subscription_id
                )
            )
            
            if existing:
                existing.status = "canceled" # Lock them out!
                await db.commit()
                print(f"✅ Subscription {subscription_id} successfully canceled.")
        except Exception as e:
            print(f"❌ Database Error (Cancel Sub): {e}")
    return {"status": "ok"}
def _assert_site_owner(ctx, website: Website):
    # If you later add roles/ownership checks, enforce here.
    # For now ctx["member"] belongs to website already (via subdomain),
    # so we allow it.
    return True

@router.get("/builder/websites/{website_id}/products")
async def list_products_owner(
    website_id: str,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user),
):
    website = await db.scalar(_get_owned_website_stmt(website_id, current_user.id))
    if not website:
        raise HTTPException(403, "You do not own this website.")

    rows = await db.execute(
        select(SiteProduct)
        .where(SiteProduct.website_id == website.website_id)
        .order_by(SiteProduct.created_at.desc())
    )
    return [
        dict(
            product_id=str(r.product_id),
            name=r.name,
            description=r.description,
            stripe_price_id=r.stripe_price_id,
            currency=r.currency,
            amount_cents=int(r.amount_cents),
            active=r.active,
        )
        for r in rows.scalars().all()
    ]

class UpsertProductDTO(BaseModel):
    name: str
    description: str | None = None
    stripe_price_id: str
    currency: str
    amount_cents: int
    active: bool = True

@router.post("/builder/websites/{website_id}/products")
async def create_product_owner(
    website_id: str,
    body: UpsertProductDTO,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user),
):
    website = await db.scalar(_get_owned_website_stmt(website_id, current_user.id))
    if not website:
        raise HTTPException(403, "You do not own this website.")

    p = SiteProduct(
        website_id=website.website_id,
        name=body.name,
        description=body.description,
        stripe_price_id=body.stripe_price_id,
        currency=body.currency.lower(),
        amount_cents=body.amount_cents,
        active=body.active,
    )
    db.add(p)
    await db.commit()
    await db.refresh(p)
    return {"ok": True, "product_id": str(p.product_id)}

@router.put("/builder/websites/{website_id}/products/{product_id}")
async def update_product_owner(
    website_id: str,
    product_id: str,
    body: UpsertProductDTO,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user),
):
    # Verify ownership
    website = await db.scalar(
        select(Website).where(
            Website.website_id == website_id,
            Website.owner_id == current_user.id
        )
    )
    if not website:
        raise HTTPException(403, "You do not own this website.")

    row = await db.scalar(
        select(SiteProduct).where(
            SiteProduct.product_id == product_id,
            SiteProduct.website_id == website.website_id
        )
    )
    if not row:
        raise HTTPException(404, "Product not found")

    row.name = body.name
    row.description = body.description
    row.stripe_price_id = body.stripe_price_id
    row.currency = body.currency.lower()
    row.amount_cents = body.amount_cents
    row.active = body.active

    await db.commit()
    return {"ok": True}

@router.get("/{subdomain}/has-purchase", response_model=bool)
async def has_purchase(
    subdomain: str,
    website_id: str,
    member_id: str,
    product_id: str,
    db: AsyncSession = Depends(get_db),
) -> bool:
    q = select(SitePurchase).where(
        SitePurchase.website_id == website_id,
        SitePurchase.member_id == member_id,
        SitePurchase.product_id == product_id,
        SitePurchase.status.in_(["paid", "active"])  # ✅ NOW IT ALLOWS SUBSCRIPTIONS!
    )
    return bool(await db.scalar(q))

@router.get("/builder/websites/{website_id}/stripe-config")
async def read_stripe_config_owner(
    website_id: str,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user),
):
    website = await db.scalar(_get_owned_website_stmt(website_id, current_user.id))
    if not website:
        raise HTTPException(403, "You do not own this website.")

    row = await db.scalar(
        select(WebsiteStripeAccount).where(WebsiteStripeAccount.website_id == website_id)
    )
    if not row:
        return {"exists": False}

    last4 = (
        row.stripe_secret_key[-4:]
        if row.stripe_secret_key and len(row.stripe_secret_key) >= 4
        else None
    )
    return {
        "exists": True,
        "secret_key_last4": last4,
        "has_webhook": bool(row.stripe_webhook_secret),
        "created_at": row.created_at,
        "updated_at": row.updated_at,
    }


@router.get("/builder/websites/{website_id}/stripe/price/{price_id}")
async def get_price_details(
    website_id: str,
    price_id: str,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user),
):
    # 1) Verify the caller owns this website
    website = await db.get(Website, website_id)
    if not website:
        raise HTTPException(404, "Website not found")

    # TODO: replace this with your actual ownership check
    # (e.g., join RestaurantOwner by website.restaurant_id and compare user_id)
    # If not owner: raise HTTPException(403, "You do not own this website.")

    # 2) Load the website’s Stripe keys
    acct = await db.scalar(
        select(WebsiteStripeAccount).where(WebsiteStripeAccount.website_id == website_id)
    )
    if not acct:
        raise HTTPException(400, "Stripe not configured for this website")

    # 3) Call Stripe
    try:
        stripe.api_key = acct.stripe_secret_key
        price = stripe.Price.retrieve(price_id, expand=["product"])
    except Exception as e:
        raise HTTPException(400, f"Stripe error: {e}")

    # 4) Build response
    prod = price.get("product")
    product_name = (prod.get("name") if isinstance(prod, dict) else None) or ""
    stripe_product_id = (prod.get("id") if isinstance(prod, dict) else None) or (
        price.get("product") if isinstance(price.get("product"), str) else None
    )

    return {
        "price_id": price.get("id"),
        "currency": price.get("currency"),
        "unit_amount": price.get("unit_amount"),
        "recurring": price.get("recurring") or None,
        "product_id": stripe_product_id,
        "product_name": product_name,
    }
