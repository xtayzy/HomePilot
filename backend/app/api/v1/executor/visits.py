"""Executor: визиты, старт, завершение, no-show, загрузка фото."""
from datetime import date, timedelta
from uuid import UUID

from fastapi import APIRouter, Depends, Query, UploadFile, File, Form
from sqlalchemy import select, or_
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import CurrentUser, DbSession
from app.core.exceptions import VisitNotFoundError, ForbiddenError
from app.models import Visit, VisitPhoto, VisitChecklistResult, Subscription, ChecklistTemplate, ChecklistItem
from app.models.user import UserRole
from app.schemas.visit import VisitCompleteRequest
from app.services import visit as visit_service
from app.services import storage as storage_service

router = APIRouter(prefix="/executor", tags=["executor"])


def _executor_only(current_user: CurrentUser):
    if current_user.role != UserRole.executor:
        raise ForbiddenError("Доступ только для исполнителя")
    return current_user


@router.get("/visits", response_model=list[dict])
async def list_executor_visits(
    current_user: CurrentUser,
    db: DbSession,
    date_from: date | None = Query(None),
    date_to: date | None = Query(None),
):
    _executor_only(current_user)
    if not date_from:
        date_from = date.today()
    if not date_to:
        date_to = date_from + timedelta(days=7)
    result = await db.execute(
        select(Visit)
        .where(
            Visit.executor_id == current_user.id,
            Visit.scheduled_date >= date_from,
            Visit.scheduled_date <= date_to,
        )
        .options(selectinload(Visit.subscription).selectinload(Subscription.user))
        .order_by(Visit.scheduled_date, Visit.time_slot_start)
    )
    visits = result.scalars().all()
    return [
        {
            "id": v.id,
            "scheduled_date": v.scheduled_date,
            "time_slot_start": v.time_slot_start,
            "time_slot_end": v.time_slot_end,
            "status": v.status.value if hasattr(v.status, "value") else v.status,
            "address": f"{v.subscription.address_street}, {v.subscription.address_building}, {v.subscription.address_flat}" if v.subscription else None,
            "client_phone": v.subscription.user.phone if v.subscription and v.subscription.user else None,
        }
        for v in visits
    ]


@router.get("/visits/{visit_id}")
async def get_executor_visit(
    visit_id: UUID,
    current_user: CurrentUser,
    db: DbSession,
):
    _executor_only(current_user)
    result = await db.execute(
        select(Visit)
        .where(Visit.id == visit_id, Visit.executor_id == current_user.id)
        .options(
            selectinload(Visit.subscription).selectinload(Subscription.user),
            selectinload(Visit.subscription).selectinload(Subscription.apartment_type),
            selectinload(Visit.subscription).selectinload(Subscription.tariff),
        )
    )
    visit = result.scalar_one_or_none()
    if not visit:
        raise VisitNotFoundError()
    sub = visit.subscription
    cleaning_type = sub.tariff.cleaning_type.value if sub.tariff else "full"
    apartment_type_id = sub.apartment_type_id if sub else None

    template_res = await db.execute(
        select(ChecklistTemplate)
        .where(ChecklistTemplate.cleaning_type == cleaning_type)
        .where(or_(ChecklistTemplate.apartment_type_id == apartment_type_id, ChecklistTemplate.apartment_type_id.is_(None)))
        .order_by(ChecklistTemplate.apartment_type_id.desc().nulls_last())
        .limit(1)
    )
    template = template_res.scalar_one_or_none()
    checklist_items = []
    if template:
        items_res = await db.execute(
            select(ChecklistItem).where(ChecklistItem.template_id == template.id).order_by(ChecklistItem.sort_order)
        )
        checklist_items = [
            {"id": str(i.id), "title_ru": i.title_ru, "title_kk": i.title_kk, "sort_order": i.sort_order}
            for i in items_res.scalars().all()
        ]

    return {
        "id": visit.id,
        "scheduled_date": visit.scheduled_date,
        "time_slot_start": visit.time_slot_start,
        "time_slot_end": visit.time_slot_end,
        "status": visit.status.value if hasattr(visit.status, "value") else visit.status,
        "address_street": sub.address_street,
        "address_building": sub.address_building,
        "address_flat": sub.address_flat,
        "address_comment": sub.address_comment,
        "client_phone": sub.user.phone,
        "cleaning_type": cleaning_type,
        "apartment_type": sub.apartment_type.code if sub.apartment_type else None,
        "checklist_items": checklist_items,
    }


@router.post("/visits/{visit_id}/start")
async def start_visit(
    visit_id: UUID,
    current_user: CurrentUser,
    db: DbSession,
):
    _executor_only(current_user)
    from app.models.visit import VisitStatus
    result = await db.execute(
        select(Visit).where(Visit.id == visit_id, Visit.executor_id == current_user.id)
    )
    visit = result.scalar_one_or_none()
    if not visit:
        raise VisitNotFoundError()
    visit.status = VisitStatus.in_progress
    await db.flush()
    return {"message": "Визит начат"}


@router.post("/visits/{visit_id}/complete")
async def complete_visit(
    visit_id: UUID,
    payload: VisitCompleteRequest,
    current_user: CurrentUser,
    db: DbSession,
):
    _executor_only(current_user)
    results = [{"checklist_item_id": r.checklist_item_id, "done": r.done, "photo_id": r.photo_id} for r in payload.results]
    await visit_service.complete_visit(db, visit_id, current_user.id, results)
    return {"message": "Визит завершён"}


@router.post("/visits/{visit_id}/upload-photo")
async def upload_visit_photo(
    visit_id: UUID,
    current_user: CurrentUser,
    db: DbSession,
    file: UploadFile = File(...),
    checklist_item_id: UUID | None = Form(None),
):
    _executor_only(current_user)
    result = await db.execute(
        select(Visit).where(Visit.id == visit_id, Visit.executor_id == current_user.id)
    )
    visit = result.scalar_one_or_none()
    if not visit:
        raise VisitNotFoundError()
    rel_path, file_size, content_type = await storage_service.save_visit_photo(
        visit_id, file, checklist_item_id
    )
    photo = VisitPhoto(
        visit_id=visit_id,
        checklist_item_id=checklist_item_id,
        file_path=rel_path,
        file_size=file_size,
        content_type=content_type,
    )
    db.add(photo)
    await db.flush()
    await db.refresh(photo)
    return {"id": str(photo.id), "file_path": photo.file_path}


@router.post("/visits/{visit_id}/no-show")
async def no_show_visit(
    visit_id: UUID,
    current_user: CurrentUser,
    db: DbSession,
):
    _executor_only(current_user)
    await visit_service.no_show_visit(db, visit_id, current_user.id)
    return {"message": "Отмечена неявка"}
