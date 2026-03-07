"""Subscriptions: создание, текущая, по id, обновление."""
from uuid import UUID
from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import CurrentUser, DbSession, require_role
from app.core.exceptions import NotFoundError
from app.models import Subscription
from app.models.subscription import SubscriptionStatus
from app.schemas.subscription import SubscriptionCreate, SubscriptionUpdate, SubscriptionResponse
from app.services import subscription as sub_service

router = APIRouter(prefix="/subscriptions", tags=["subscriptions"])


def _subscription_to_response(sub: Subscription, price: int | None = None) -> dict:
    d = SubscriptionResponse.model_validate(sub).model_dump()
    if price is not None:
        d["price_month_kzt"] = price
    if hasattr(sub, "tariff") and sub.tariff is not None:
        d["tariff_cleaning_type"] = sub.tariff.cleaning_type.value
    if hasattr(sub, "apartment_type") and sub.apartment_type is not None:
        d["apartment_type_duration_light_min"] = sub.apartment_type.duration_light_min
        d["apartment_type_duration_full_min"] = sub.apartment_type.duration_full_min
    return d


@router.get("", response_model=list)
@router.get("/", response_model=list)
async def list_subscriptions(
    current_user: CurrentUser,
    db: DbSession,
):
    """Список подписок пользователя (черновики без оплаты не показываем)."""
    result = await db.execute(
        select(Subscription)
        .where(
            Subscription.user_id == current_user.id,
            Subscription.status != SubscriptionStatus.draft,
        )
        .order_by(Subscription.created_at.desc())
        .options(
            selectinload(Subscription.tariff),
            selectinload(Subscription.apartment_type),
            selectinload(Subscription.city),
        )
    )
    subs = result.scalars().all()
    out = []
    for sub in subs:
        await sub_service.ensure_active_subscription_dates(db, sub)
        price = await sub_service.get_price_for_subscription(
            db, sub.tariff_id, sub.apartment_type_id
        )
        out.append(_subscription_to_response(sub, price))
    return out


@router.post("", status_code=201)
async def create_subscription(
    payload: SubscriptionCreate,
    current_user: CurrentUser,
    db: DbSession,
):
    if not payload.accept_offer:
        from fastapi import HTTPException
        raise HTTPException(status_code=400, detail="Необходимо принять оферту")
    sub, price = await sub_service.create_subscription(db, current_user.id, payload)
    return _subscription_to_response(sub, price)


@router.get("/current")
async def get_current_subscription(
    current_user: CurrentUser,
    db: DbSession,
):
    result = await db.execute(
        select(Subscription)
        .where(
            Subscription.user_id == current_user.id,
            Subscription.status != SubscriptionStatus.draft,
        )
        .order_by(Subscription.created_at.desc())
        .limit(1)
        .options(
            selectinload(Subscription.tariff),
            selectinload(Subscription.apartment_type),
            selectinload(Subscription.city),
            selectinload(Subscription.visits),
            selectinload(Subscription.executor),
        )
    )
    sub = result.scalar_one_or_none()
    if not sub:
        raise NotFoundError("Подписка не найдена")
    await sub_service.ensure_active_subscription_dates(db, sub)
    price = await sub_service.get_price_for_subscription(
        db, sub.tariff_id, sub.apartment_type_id
    )
    return _subscription_to_response(sub, price)


@router.get("/{subscription_id}")
async def get_subscription(
    subscription_id: UUID,
    current_user: CurrentUser,
    db: DbSession,
):
    result = await db.execute(
        select(Subscription)
        .where(
            Subscription.id == subscription_id,
            Subscription.user_id == current_user.id,
        )
        .options(
            selectinload(Subscription.tariff),
            selectinload(Subscription.apartment_type),
        )
    )
    sub = result.scalar_one_or_none()
    if not sub:
        raise NotFoundError("Подписка не найдена")
    await sub_service.ensure_active_subscription_dates(db, sub)
    price = await sub_service.get_price_for_subscription(
        db, sub.tariff_id, sub.apartment_type_id
    )
    return _subscription_to_response(sub, price)


@router.patch("/{subscription_id}")
async def update_subscription(
    subscription_id: UUID,
    payload: SubscriptionUpdate,
    current_user: CurrentUser,
    db: DbSession,
):
    result = await db.execute(
        select(Subscription).where(
            Subscription.id == subscription_id,
            Subscription.user_id == current_user.id,
        )
    )
    sub = result.scalar_one_or_none()
    if not sub:
        raise NotFoundError("Подписка не найдена")
    data = payload.model_dump(exclude_unset=True)
    for k, v in data.items():
        if hasattr(sub, k):
            setattr(sub, k, v)
    await db.flush()
    await db.refresh(sub)
    price = await sub_service.get_price_for_subscription(
        db, sub.tariff_id, sub.apartment_type_id
    )
    return _subscription_to_response(sub, price)
