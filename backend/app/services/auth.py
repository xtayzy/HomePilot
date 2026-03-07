"""Auth service: register, login, refresh, password."""
import secrets
from datetime import datetime, timedelta, timezone
from uuid import UUID

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.core.security import (
    get_password_hash,
    verify_password,
    create_access_token,
    create_refresh_token,
    decode_token,
)
from app.core.exceptions import (
    ForbiddenError,
    ConflictError,
    InvalidInviteCodeError,
    NotFoundError,
)
from app.models import User
from app.models.email_confirm_code import EmailConfirmCode
from app.models.user import UserRole
from app.models.executor_invite import ExecutorInvite
from app.schemas.auth import RegisterRequest, RegisterExecutorRequest
from app.services.notifications import send_registration_confirm_email


async def register_client(db: AsyncSession, payload: RegisterRequest) -> User:
    existing = await db.execute(select(User).where(User.email == payload.email))
    if existing.scalar_one_or_none():
        raise ConflictError("Email уже зарегистрирован")
    user = User(
        email=payload.email,
        password_hash=get_password_hash(payload.password),
        role=UserRole.client,
        name=payload.name,
        phone=payload.phone,
        locale=payload.locale or "ru",
    )
    db.add(user)
    await db.flush()
    await db.refresh(user)

    # Отправляем письмо с 6-значным кодом подтверждения email.
    code = await _generate_email_confirm_code(db, user.id)
    print(">>> REGISTER: отправляю письмо с кодом на", user.email, "<<<", flush=True)
    send_registration_confirm_email(user.email, code, locale=user.locale)

    return user


async def register_executor(db: AsyncSession, payload: RegisterExecutorRequest) -> User:
    invite = await db.execute(
        select(ExecutorInvite).where(
            ExecutorInvite.code == payload.invite_code,
            ExecutorInvite.used_by_id.is_(None),
        )
    )
    inv = invite.scalar_one_or_none()
    if not inv or inv.expires_at.tzinfo and __import__("datetime").datetime.now(inv.expires_at.tzinfo) > inv.expires_at:
        raise InvalidInviteCodeError()
    existing = await db.execute(select(User).where(User.email == payload.email))
    if existing.scalar_one_or_none():
        raise ConflictError("Email уже зарегистрирован")
    user = User(
        email=payload.email,
        password_hash=get_password_hash(payload.password),
        role=UserRole.executor,
        name=payload.name,
        phone=payload.phone,
        executor_status="active",
        email_verified_at=datetime.now(timezone.utc),
    )
    db.add(user)
    await db.flush()
    inv.used_by_id = user.id
    inv.used_at = datetime.now(timezone.utc)
    await db.flush()
    await db.refresh(user)
    return user


async def authenticate_user(db: AsyncSession, email: str, password: str) -> User | None:
    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()
    if not user or not user.password_hash or not verify_password(password, user.password_hash):
        return None
    # Для клиентов требуем подтверждённый email перед входом.
    if user.role == UserRole.client and not user.email_verified_at:
        raise ForbiddenError("Email не подтверждён. Проверьте почту и введите 6-значный код из письма.")
    return user


def tokens_for_user(user: User) -> tuple[str, str, int]:
    access, expires_sec = create_access_token(user.id, user.role.value)
    refresh = create_refresh_token(user.id)
    return access, refresh, expires_sec


async def get_user_by_refresh_token(db: AsyncSession, refresh_token: str) -> User | None:
    payload = decode_token(refresh_token)
    if not payload or payload.get("type") != "refresh":
        return None
    sub = payload.get("sub")
    if not sub:
        return None
    try:
        uid = UUID(sub)
    except ValueError:
        return None
    result = await db.execute(select(User).where(User.id == uid, User.is_active == True))
    return result.scalar_one_or_none()


async def _generate_email_confirm_code(db: AsyncSession, user_id: UUID) -> str:
    """Генерирует 6-значный код и сохраняет в БД."""
    settings = get_settings()
    expires_at = datetime.now(timezone.utc) + timedelta(
        minutes=settings.EMAIL_CONFIRM_CODE_EXPIRE_MINUTES
    )
    # Удаляем старые коды для этого пользователя
    await db.execute(delete(EmailConfirmCode).where(EmailConfirmCode.user_id == user_id))
    # Генерируем уникальный 6-значный код
    for _ in range(10):
        code = "".join(secrets.choice("0123456789") for _ in range(6))
        existing = await db.execute(select(EmailConfirmCode).where(EmailConfirmCode.code == code))
        if existing.scalar_one_or_none():
            continue
        rec = EmailConfirmCode(code=code, user_id=user_id, expires_at=expires_at)
        db.add(rec)
        await db.flush()
        return code
    raise RuntimeError("Не удалось сгенерировать уникальный код подтверждения")


async def confirm_email(db: AsyncSession, code: str) -> User:
    """Подтверждение email по 6-значному коду из письма."""
    code = code.strip()
    if len(code) != 6 or not code.isdigit():
        raise ForbiddenError("Неверный формат кода. Введите 6 цифр из письма.")

    result = await db.execute(
        select(EmailConfirmCode).where(
            EmailConfirmCode.code == code,
            EmailConfirmCode.expires_at > datetime.now(timezone.utc),
        )
    )
    rec = result.scalar_one_or_none()
    if not rec:
        raise ForbiddenError("Недействительный или просроченный код подтверждения")

    result = await db.execute(select(User).where(User.id == rec.user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise NotFoundError("Пользователь не найден")

    await db.execute(delete(EmailConfirmCode).where(EmailConfirmCode.code == code))

    if not user.email_verified_at:
        user.email_verified_at = datetime.now(timezone.utc)
        await db.flush()
        await db.refresh(user)

    return user
