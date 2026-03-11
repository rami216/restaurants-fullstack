# payments/router.py

import stripe
from fastapi import APIRouter, Depends, HTTPException, Request, Header
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
import os
from decimal import Decimal
 
from database import get_db
from models import User, RestaurantOwner
from auth.auth_handler import get_current_active_user
from schemas import CheckoutSessionResponse, BillingPortalResponse, TopUpRequest
from website_builder.models import Website
from agents.zygo_models import ZygoSubscription, ZygoTrigger,ZygoUser
from agents.zygo_routes import get_zygo_user_from_token
STRIPE_SECRET_KEY = os.getenv("STRIPE_SECRET_KEY")
STRIPE_WEBHOOK_SECRET = os.getenv("STRIPE_WEBHOOK_SECRET")
RECURRING_PRICE_ID = os.getenv("RECURRING_PRICE_ID")

stripe.api_key = STRIPE_SECRET_KEY
router = APIRouter(prefix="/payments", tags=["Payments"])
YOUR_DOMAIN = "https://www.zygoflow.com"

@router.post("/create-subscription-checkout", response_model=CheckoutSessionResponse)
async def create_subscription_checkout(
    current_user: User = Depends(get_current_active_user),
):
    """
    Creates a Stripe Checkout session for the simple $20/month base subscription.
    """
    try:
        checkout_session = stripe.checkout.Session.create(
            payment_method_types=['card'],
            line_items=[{ 'price': RECURRING_PRICE_ID, 'quantity': 1 }],
            mode='subscription',
            success_url=YOUR_DOMAIN + '/success?session_id={CHECKOUT_SESSION_ID}',
            cancel_url=YOUR_DOMAIN + '/cancel',
            customer_email=current_user.email,
            metadata={ 'user_id': current_user.id, 'type': 'subscription' }
        )
        return {"sessionId": checkout_session.id}
    except Exception as e:
        # THIS IS THE NEW LINE THAT WILL SHOW US THE REAL ERROR
        print(f"Stripe Error creating subscription: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/create-top-up-session", response_model=CheckoutSessionResponse)
async def create_top_up_session(
    top_up_request: TopUpRequest,
    current_user: User = Depends(get_current_active_user),
):
    """
    Creates a one-time payment session for adding funds to the user's wallet.
    """
    try:
        amount_in_cents = int(top_up_request.amount * 100)
        checkout_session = stripe.checkout.Session.create(
            payment_method_types=['card'],
            line_items=[{
                'price_data': {
                    'currency': 'usd',
                    'product_data': { 'name': 'Top-up Credits' },
                    'unit_amount': amount_in_cents,
                },
                'quantity': 1,
            }],
            mode='payment',
            success_url=YOUR_DOMAIN + '/success?session_id={CHECKOUT_SESSION_ID}',
            cancel_url=YOUR_DOMAIN + '/cancel',
            customer_email=current_user.email,
            metadata={
                'user_id': current_user.id,
                'type': 'top-up',
                'amount': top_up_request.amount
            }
        )
        return {"sessionId": checkout_session.id}
    except Exception as e:
        print(f"Stripe Error creating top-up: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/create-billing-portal-session", response_model=BillingPortalResponse)
async def create_billing_portal_session(
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(RestaurantOwner).where(RestaurantOwner.user_id == current_user.id))
    owner = result.scalars().first()
    if not owner or not owner.stripe_customer_id:
        raise HTTPException(status_code=404, detail="Stripe customer not found for this user.")
    try:
        portal_session = stripe.billing_portal.Session.create(
            customer=owner.stripe_customer_id,
            return_url=YOUR_DOMAIN + '/main',
        )
        return {"url": portal_session.url}
    except Exception as e:
        print(f"Stripe Error creating billing portal: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/webhook")
async def stripe_webhook(
    request: Request,
    stripe_signature: str = Header(None),
    db: AsyncSession = Depends(get_db)
):
    body = await request.body()
    try:
        event = stripe.Webhook.construct_event(
            payload=body, sig_header=stripe_signature, secret=STRIPE_WEBHOOK_SECRET
        )
    except Exception as e:
        print(f"Webhook Error: {e}")
        raise HTTPException(status_code=400, detail=str(e))

    session = event['data']['object']
    
    print(f"\n--- 🚨 ZYGOFLOW WEBHOOK DEBUG START 🚨 ---")
    print(f"1. Event Type: {event['type']}")
    
    # ✅ CASE 1: MONTH 1 (First time they buy)
    if event['type'] == 'checkout.session.completed':
        md = session.get('metadata', {})
        print(f"2. Metadata received: {md}")
        
        user_id = md.get('user_id')
        payment_type = md.get('type')
        
        if not user_id: 
            print("❌ ERROR: User ID not found in metadata.")
            return {"status": "User ID not in metadata"}

        result = await db.execute(select(RestaurantOwner).where(RestaurantOwner.user_id == int(user_id)))
        owner = result.scalars().first()
        if not owner: 
            print(f"❌ ERROR: Could not find RestaurantOwner with user_id={user_id}")
            return {"status": "Owner not found"}
        
        # 🐛 FIX: Changed owner.id to owner.restaurant_id
        print(f"3. Found Owner: {owner.restaurant_id}. Payment Type: {payment_type}")
        
        if payment_type == 'subscription':
            stripe_sub_id = session.get('subscription')
            print(f"4. Updating Owner to ACTIVE. Sub ID: {stripe_sub_id}")
            owner.stripe_customer_id = session.get('customer')
            owner.stripe_subscription_id = stripe_sub_id
            owner.subscription_status = 'active'
            
            # 🐛 FIX: Changed owner.id to owner.restaurant_id
            print(f"5. Searching for Websites belonging to restaurant_id: {owner.restaurant_id}")
            web_result = await db.execute(select(Website).where(Website.restaurant_id == owner.restaurant_id))
            websites = web_result.scalars().all()
            
            if websites:
                for w in websites:
                    w.monthly_spend_usd = 0.0
                    print(f"✅ Month 1 Reset: Set monthly_spend_usd to 0 for website {w.website_id}")
            else:
                print(f"ℹ️ User subscribed, but has no websites yet. Skipping spend reset.")
        
        await db.commit()
        print("✅ DB Commit Successful for Checkout Session.")

    # ✅ CASE 2: MONTH 2+ (Renewals)
    elif event['type'] == 'invoice.payment_succeeded':
        parent_obj = session.get("parent") or {}
        sub_details = parent_obj.get("subscription_details") or {}
        
        stripe_subscription_id = session.get('subscription') or sub_details.get("subscription")
        print(f"2. Extracted Subscription ID: {stripe_subscription_id}")
        
        if stripe_subscription_id:
            result = await db.execute(select(RestaurantOwner).where(RestaurantOwner.stripe_subscription_id == stripe_subscription_id))
            owner = result.scalars().first()
            
            if owner:
                # 🐛 FIX: Changed owner.id to owner.restaurant_id
                print(f"3. Found Owner {owner.restaurant_id} for this subscription.")
                owner.subscription_status = 'active' 
                
                # 🐛 FIX: Changed owner.id to owner.restaurant_id
                web_result = await db.execute(select(Website).where(Website.restaurant_id == owner.restaurant_id))
                websites = web_result.scalars().all()
                
                if websites:
                    for w in websites:
                        w.monthly_spend_usd = 0.0
                        print(f"✅ Zygoflow Renewal Reset: Set monthly_spend_usd to 0 for website {w.website_id}")
                else:
                    print(f"ℹ️ Zygoflow Renewal paid, but user has no active websites.")
                
                await db.commit()
                print("✅ DB Commit Successful for Invoice Succeeded.")
            else:
                print(f"❌ DATABASE MISS: No RestaurantOwner found with stripe_subscription_id={stripe_subscription_id}")
        else:
            print("❌ No subscription ID found in this invoice event.")

    print(f"--- 🚨 ZYGOFLOW WEBHOOK DEBUG END 🚨 ---\n")
    return {"status": "success"}


#region zygoagents
@router.post("/stripe-webhook")
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

@router.post("/subscribe")
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
