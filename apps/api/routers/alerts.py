from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from apps.api.database import get_db
from apps.api.models import AlertEvent, AlertRule
from apps.api.schemas.alert import AlertEventOut, AlertRuleCreate, AlertRuleOut

router = APIRouter(prefix="/v1/alerts", tags=["alerts"])


@router.get("/rules", response_model=list[AlertRuleOut])
async def list_rules(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(AlertRule).order_by(AlertRule.created_at.desc()))
    return result.scalars().all()


@router.post("/rules", response_model=AlertRuleOut, status_code=201)
async def create_rule(payload: AlertRuleCreate, db: AsyncSession = Depends(get_db)):
    rule = AlertRule(**payload.model_dump())
    db.add(rule)
    await db.flush()
    return rule


@router.put("/rules/{rule_id}", response_model=AlertRuleOut)
async def update_rule(rule_id: UUID, payload: AlertRuleCreate, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(AlertRule).where(AlertRule.id == rule_id))
    rule = result.scalar_one_or_none()
    if not rule:
        raise HTTPException(404, "Alert rule not found")
    for k, v in payload.model_dump().items():
        setattr(rule, k, v)
    await db.flush()
    return rule


@router.delete("/rules/{rule_id}", status_code=204)
async def delete_rule(rule_id: UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(AlertRule).where(AlertRule.id == rule_id))
    rule = result.scalar_one_or_none()
    if not rule:
        raise HTTPException(404, "Alert rule not found")
    await db.delete(rule)


@router.get("/history", response_model=list[AlertEventOut])
async def get_alert_history(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(AlertEvent).order_by(AlertEvent.triggered_at.desc()).limit(200)
    )
    return result.scalars().all()
