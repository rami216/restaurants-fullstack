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

# --- CONFIGURATION ---
STRIPE_SECRET_KEY = "sk_test_51PoT3lJ436yrzjfSmv9FaegFSGFr0NKmbalj7Dmkz4yCEYjnlv3cEzNpYuxeCDjnFs8Av5V1WeLiBvOUA12nyYpw004M8Vpx1D"
STRIPE_WEBHOOK_SECRET = "whsec_DVjOkdltatRzKK9VFirNG40mt1TpvLR7"

RECURRING_PRICE_ID = "price_1RjNRrJ436yrzjfSAATBGkqe"

stripe.api_key = STRIPE_SECRET_KEY
router = APIRouter(prefix="/payments", tags=["Payments"])
YOUR_DOMAIN = "http://localhost:3000"

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
    if event['type'] == 'checkout.session.completed':
        user_id = session.get('metadata', {}).get('user_id')
        if not user_id: return {"status": "User ID not in metadata"}

        result = await db.execute(select(RestaurantOwner).where(RestaurantOwner.user_id == int(user_id)))
        owner = result.scalars().first()
        if not owner: return {"status": "Owner not found"}
        
        payment_type = session.get('metadata', {}).get('type')
        if payment_type == 'subscription':
            owner.stripe_customer_id = session.get('customer')
            owner.stripe_subscription_id = session.get('subscription')
            owner.subscription_status = 'active'
        elif payment_type == 'top-up':
            amount_added = session.get('metadata', {}).get('amount')
            if amount_added:
                owner.credit_balance += Decimal(amount_added)
        await db.commit()

    elif event['type'] in ['customer.subscription.updated', 'customer.subscription.deleted']:
        subscription = event['data']['object']
        stripe_subscription_id = subscription.get('id')
        result = await db.execute(select(RestaurantOwner).where(RestaurantOwner.stripe_subscription_id == stripe_subscription_id))
        owner = result.scalars().first()
        if owner:
            owner.subscription_status = subscription.get('status')
            await db.commit()
    
    return {"status": "success"}
