"""Payment service: create intent, confirm by code (test), handle webhook."""
import logging
import secrets
from datetime import datetime, timedelta, timezone
from uuid import UUID

logger = logging.getLogger(__name__)

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.models import Payment, Subscription
from app.models.payment import PaymentStatus
from app.models.payment_confirm_code import PaymentConfirmCode
from app.services.subscription import activate_subscription


async def _generate_payment_confirm_code(db: AsyncSession, payment_id: UUID) -> str:
    """Генерирует 6-значный код подтверждения списания и сохраняет в БД."""
    settings = get_settings()
    expires_at = datetime.now(timezone.utc) + timedelta(
        minutes=settings.PAYMENT_CONFIRM_CODE_EXPIRE_MINUTES
    )
    await db.execute(delete(PaymentConfirmCode).where(PaymentConfirmCode.payment_id == payment_id))
    for _ in range(10):
        code = "".join(secrets.choice("0123456789") for _ in range(6))
        existing = await db.execute(select(PaymentConfirmCode).where(PaymentConfirmCode.code == code))
        if existing.scalar_one_or_none():
            continue
        rec = PaymentConfirmCode(code=code, payment_id=payment_id, expires_at=expires_at)
        db.add(rec)
        await db.flush()
        return code
    raise RuntimeError("Не удалось сгенерировать уникальный код подтверждения оплаты")


async def create_payment_intent(
    db: AsyncSession,
    subscription_id,
    user_id,
    return_url: str | None = None,
) -> tuple[Payment, str | None, str | None]:
    """Создаёт платёж (pending) и при тестовом режиме — код подтверждения списания.
    Возвращает (payment, redirect_url, confirm_code или None).
    """
    result = await db.execute(
        select(Subscription).where(
            Subscription.id == subscription_id,
            Subscription.user_id == user_id,
            Subscription.status == "draft",
        )
    )
    sub = result.scalar_one_or_none()
    if not sub:
        from app.core.exceptions import NotFoundError
        raise NotFoundError("Подписка не найдена")
    from app.services.subscription import get_price_for_subscription
    amount = await get_price_for_subscription(db, sub.tariff_id, sub.apartment_type_id)
    if not amount:
        from app.core.exceptions import AppException
        raise AppException("Не удалось определить сумму", status_code=400)
    payment = Payment(
        user_id=user_id,
        subscription_id=subscription_id,
        amount_kzt=amount,
        status=PaymentStatus.pending,
        external_id="mock_" + str(subscription_id)[:8],
    )
    db.add(payment)
    await db.flush()
    await db.refresh(payment)

    confirm_code = await _generate_payment_confirm_code(db, payment.id)
    logger.warning(">>> КОД ПОДТВЕРЖДЕНИЯ ОПЛАТЫ (введите на странице): %s <<<", confirm_code)

    redirect_url = return_url or f"/payment/complete?payment_id={payment.id}"
    return payment, redirect_url, confirm_code


async def confirm_payment_by_code(
    db: AsyncSession,
    payment_id: UUID,
    user_id: UUID,
    code: str,
) -> Payment:
    """Подтверждение списания по 6-значному коду (тестовый платёж)."""
    from app.core.exceptions import ForbiddenError, NotFoundError

    code = code.strip()
    if len(code) != 6 or not code.isdigit():
        raise ForbiddenError("Неверный формат кода. Введите 6 цифр из SMS/приложения банка.")

    result = await db.execute(
        select(PaymentConfirmCode).where(
            PaymentConfirmCode.code == code,
            PaymentConfirmCode.expires_at > datetime.now(timezone.utc),
        )
    )
    rec = result.scalar_one_or_none()
    if not rec or str(rec.payment_id) != str(payment_id):
        raise ForbiddenError("Недействительный или просроченный код подтверждения оплаты.")

    result = await db.execute(
        select(Payment).where(
            Payment.id == payment_id,
            Payment.user_id == user_id,
            Payment.status == PaymentStatus.pending,
        )
    )
    payment = result.scalar_one_or_none()
    if not payment:
        raise NotFoundError("Платёж не найден или уже проведён.")

    payment.status = PaymentStatus.completed
    payment.paid_at = datetime.now(timezone.utc)
    if payment.subscription_id:
        await activate_subscription(db, payment.subscription_id)
    await db.execute(delete(PaymentConfirmCode).where(PaymentConfirmCode.code == code))
    await db.flush()
    await db.refresh(payment)
    return payment


async def handle_payment_webhook(
    db: AsyncSession,
    external_id: str,
    status: str = "completed",
) -> Payment | None:
    if status != "completed":
        return None
    result = await db.execute(
        select(Payment).where(Payment.external_id == external_id)
    )
    payment = result.scalar_one_or_none()
    if not payment or payment.status == PaymentStatus.completed:
        return payment
    payment.status = PaymentStatus.completed
    payment.paid_at = datetime.now(timezone.utc)
    await activate_subscription(db, payment.subscription_id)
    await db.flush()
    await db.refresh(payment)
    return payment
