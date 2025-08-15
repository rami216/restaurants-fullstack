# ai/billing.py
from decimal import Decimal, ROUND_HALF_UP
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from website_builder.models import Website, AIUsageLog
from config import AI_PRICE_INPUT_PER_MTOK, AI_PRICE_OUTPUT_PER_MTOK

Q = Decimal("0.000001")  # convert per-million-token price to per-token

def _money(x: Decimal) -> Decimal:
    # 6 decimal places for USD micro-precision
    return x.quantize(Decimal("0.000001"), rounding=ROUND_HALF_UP)

def calc_cost(prompt_tokens: int, completion_tokens: int) -> tuple[Decimal, Decimal, Decimal]:
    """
    Return (input_cost, output_cost, total_cost) in USD.
    Prices in config are per 1M tokens; Q converts to per-token.
    """
    pt = Decimal(prompt_tokens or 0)
    ct = Decimal(completion_tokens or 0)
    input_cost  = _money(pt * AI_PRICE_INPUT_PER_MTOK  * Q)
    output_cost = _money(ct * AI_PRICE_OUTPUT_PER_MTOK * Q)
    return input_cost, output_cost, _money(input_cost + output_cost)

async def track_ai_usage(
    db: AsyncSession,
    *,
    website_id,
    user_id=None,
    model: str,
    feature: str,
    prompt_tokens: int,
    completion_tokens: int,
    meta: dict | None = None,
) -> dict:
    """
    Inserts a usage log row (letting DB compute total_cost_usd),
    and updates Website aggregates (lifetime + monthly).
    Returns {'cost_usd': Decimal, 'limit_hit': bool}.
    """
    input_cost, output_cost, total_cost = calc_cost(prompt_tokens, completion_tokens)

    # 1) Insert log (DO NOT set total_cost_usd — it's GENERATED ALWAYS)
    log = AIUsageLog(
        website_id=website_id,
        user_id=user_id,
        model=model,
        feature=feature,
        prompt_tokens=int(prompt_tokens or 0),
        completion_tokens=int(completion_tokens or 0),
        input_cost_usd=input_cost,
        output_cost_usd=output_cost,
        meta=meta or {},
    )
    db.add(log)

    # 2) Update aggregates on Website
    w = (
        await db.execute(
            select(Website).where(Website.website_id == website_id)
        )
    ).scalars().first()
    if not w:
        raise ValueError("Website not found")

    # monthly window start (UTC 1st of current month)
    now = datetime.now(timezone.utc)
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

    if (w.monthly_period_start or month_start) < month_start:
        # new month: reset monthly spend window
        w.monthly_period_start = month_start
        w.monthly_spend_usd = Decimal("0")

    # lifetime + monthly counters
    w.total_prompt_tokens     = int(w.total_prompt_tokens or 0) + int(prompt_tokens or 0)
    w.total_completion_tokens = int(w.total_completion_tokens or 0) + int(completion_tokens or 0)
    w.total_spend_usd         = _money(Decimal(w.total_spend_usd or 0) + total_cost)
    w.monthly_spend_usd       = _money(Decimal(w.monthly_spend_usd or 0) + total_cost)

    # optional cap check
    limit_hit = False
    if w.monthly_spend_limit_usd is not None:
        limit_hit = Decimal(w.monthly_spend_usd) >= Decimal(w.monthly_spend_limit_usd)

    await db.commit()

    # If you ever need the DB-computed total_cost_usd from the log:
    # await db.refresh(log)  # then use log.total_cost_usd

    return {"cost_usd": total_cost, "limit_hit": bool(limit_hit)}
