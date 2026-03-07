"""Webhook: платёжный провайдер."""
from fastapi import APIRouter, Request, Header
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import DbSession
from app.services import payment as payment_service

router = APIRouter(prefix="/webhooks", tags=["webhooks"])


@router.post("/payment")
async def payment_webhook(
    request: Request,
    db: DbSession,
    x_webhook_signature: str | None = Header(None),
):
    body = await request.json()
    external_id = body.get("external_id") or body.get("payment_id") or body.get("id")
    status = body.get("status", "completed")
    if not external_id:
        return {"ok": False, "error": "missing external_id"}
    await payment_service.handle_payment_webhook(db, str(external_id), status=status)
    return {"ok": True}
