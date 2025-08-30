#website_builder/site_members_payments/router.py
import stripe
import json

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
    member_id  = body.get("member_id")  # <- pass this from frontend if you have it
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

    session = stripe.checkout.Session.create(
        mode="payment",
        payment_method_types=["card"],
        line_items=[{"price": product.stripe_price_id, "quantity": 1}],
        success_url=success_url,
        cancel_url=cancel_url,

        # IMPORTANT: this is what your webhook reads
        metadata={
            "type": "site_member_unlock",
            "website_id": website_id,
            "member_id": member_id or "",     # pass real value if you have it
            "product_id": product_id,
        },
    )

    return {"checkout_url": session.url}

# =========================
# Webhook (Single endpoint for all site members)
# =========================
@router.post("/webhook")
async def webhook(
    request: Request,
    db: AsyncSession = Depends(get_db),
    stripe_signature: str | None = Header(None, alias="Stripe-Signature"),
):
    payload = await request.body()

    try:
        raw = json.loads(payload)
        md = raw.get("data", {}).get("object", {}).get("metadata", {}) or {}
        website_id = md.get("website_id")
    except Exception:
        website_id = None

    if not website_id:
        return {"status": "ignored (no website_id in metadata)"}

    account = await db.scalar(
        select(WebsiteStripeAccount).where(WebsiteStripeAccount.website_id == website_id)
    )
    if not account or not account.stripe_webhook_secret:
        return {"status": "ignored (no website webhook secret configured)"}

    try:
        event = stripe.Webhook.construct_event(
            payload=payload,
            sig_header=stripe_signature,
            secret=account.stripe_webhook_secret,
        )
    except Exception as e:
        raise HTTPException(400, f"Webhook verification failed: {e}")

    # --- Handle Different Event Types ---

    if event["type"] == "checkout.session.completed":
        session = event["data"]["object"]
        if session.get("payment_status") != "paid":
            return {"status": "ignored (not paid)"}

        md = session.get("metadata") or {}
        if md.get("type") == "site_member_unlock":
            website_id = md.get("website_id")
            member_id = md.get("member_id")
            product_id = md.get("product_id")
            
            # ✅ FIX: The payment_intent is just a string ID on the session object
            payment_intent_id = session.get("payment_intent")

            if not (website_id and member_id and product_id and payment_intent_id):
                return {"status": "ignored (missing metadata for unlock)"}
            
            exists = await db.scalar(
                select(SitePurchase).where(SitePurchase.payment_intent_id == payment_intent_id)
            )
            if not exists:
                db.add(SitePurchase(
                    website_id=website_id,
                    member_id=member_id,
                    product_id=product_id,
                    status="paid",
                    payment_intent_id=payment_intent_id
                ))
                await db.commit()

    elif event["type"] == "payment_intent.succeeded":
        payment_intent = event["data"]["object"]
        md = payment_intent.get("metadata", {})

        if md.get("type") == "cart_checkout":
            website_id = md.get("website_id")
            cart_items_json = md.get("cart_items")
            
            shipping_details = payment_intent.get("address")
            customer_name = shipping_details.get("name") if shipping_details else "N/A"
            customer_email = payment_intent.get("receipt_email")
            customer_phone = shipping_details.get("phone") if shipping_details else None
            
            address_parts = [
                shipping_details.get("address", {}).get("line1"),
                shipping_details.get("address", {}).get("city"),
                shipping_details.get("address", {}).get("state"),
                shipping_details.get("address", {}).get("postal_code"),
                shipping_details.get("address", {}).get("country"),
            ]
            shipping_address = ", ".join(filter(None, address_parts))

            # Check if order already exists to prevent duplicates
            exists = await db.scalar(select(WebsiteOrder).where(WebsiteOrder.payment_intent_id == payment_intent.get("id")))
            if not exists:
                new_order = WebsiteOrder(
                    website_id=website_id,
                    customer_name=customer_name,
                    customer_email=customer_email,
                    customer_phone=customer_phone,
                    shipping_address=shipping_address,
                    cart_items=json.loads(cart_items_json) if cart_items_json else [],
                    total_amount_cents=payment_intent.get("amount"),
                    currency=payment_intent.get("currency"),
                    payment_intent_id=payment_intent.get("id"),
                    status="paid",
                )
                db.add(new_order)
                await db.commit()

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
        SitePurchase.status == "paid",
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
