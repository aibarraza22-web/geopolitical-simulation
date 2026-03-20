from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from apps.api.database import get_db
from apps.api.models import Entity, RiskScore, WeightConfiguration
from apps.api.schemas.risk import (
    HeatmapItem,
    RecomputeRequest,
    RiskScoreHistoryPoint,
    RiskScoreOut,
    WeightConfigCreate,
    WeightConfigOut,
)
from apps.api.services.scoring import ALL_THEMES, compute_entity_theme_score

router = APIRouter(prefix="/v1/risk", tags=["risk"])


@router.get("/scores", response_model=list[RiskScoreOut])
async def get_risk_scores(
    entity_id: Optional[UUID] = Query(None),
    entity_type: Optional[str] = Query(None),
    theme: Optional[str] = Query(None),
    is_current: bool = Query(True),
    db: AsyncSession = Depends(get_db),
):
    q = select(RiskScore)
    if is_current:
        q = q.where(RiskScore.is_current == True)  # noqa: E712
    if entity_id:
        q = q.where(RiskScore.entity_id == entity_id)
    if theme:
        q = q.where(RiskScore.theme == theme)
    if entity_type:
        q = q.join(Entity, Entity.id == RiskScore.entity_id).where(Entity.type == entity_type)
    q = q.order_by(RiskScore.computed_at.desc()).limit(500)
    result = await db.execute(q)
    return result.scalars().all()


@router.get("/scores/history", response_model=list[RiskScoreHistoryPoint])
async def get_score_history(
    entity_id: UUID = Query(...),
    theme: str = Query(...),
    limit: int = Query(90, le=365),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(RiskScore)
        .where(RiskScore.entity_id == entity_id, RiskScore.theme == theme)
        .order_by(RiskScore.computed_at.desc())
        .limit(limit)
    )
    scores = result.scalars().all()
    return [
        RiskScoreHistoryPoint(timestamp=s.computed_at, score=s.score, confidence=s.confidence)
        for s in reversed(scores)
    ]


@router.get("/scores/heatmap", response_model=list[HeatmapItem])
async def get_heatmap(
    theme: str = Query("conflict"),
    entity_type: str = Query("country"),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(RiskScore, Entity)
        .join(Entity, Entity.id == RiskScore.entity_id)
        .where(
            RiskScore.theme == theme,
            RiskScore.is_current == True,  # noqa: E712
            Entity.type == entity_type,
        )
        .order_by(RiskScore.score.desc())
        .limit(200)
    )
    rows = result.all()
    return [
        HeatmapItem(
            entity_id=entity.id,
            entity_name=entity.name,
            entity_type=entity.type,
            iso_code=entity.iso_code,
            theme=score.theme,
            score=score.score,
            confidence=score.confidence,
            delta_7d=score.score_delta_7d,
        )
        for score, entity in rows
    ]


# ── Weight Configurations ─────────────────────────────────────────────────────


@router.get("/weights", response_model=list[WeightConfigOut])
async def list_weight_configs(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(WeightConfiguration).order_by(WeightConfiguration.created_at.desc()))
    return result.scalars().all()


@router.post("/weights", response_model=WeightConfigOut, status_code=201)
async def create_weight_config(payload: WeightConfigCreate, db: AsyncSession = Depends(get_db)):
    config = WeightConfiguration(name=payload.name, weights=payload.weights, is_default=False)
    db.add(config)
    await db.flush()
    return config


@router.put("/weights/{config_id}", response_model=WeightConfigOut)
async def update_weight_config(
    config_id: UUID, payload: WeightConfigCreate, db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(WeightConfiguration).where(WeightConfiguration.id == config_id))
    config = result.scalar_one_or_none()
    if not config:
        raise HTTPException(404, "Weight configuration not found")
    config.name = payload.name
    config.weights = payload.weights
    config.version += 1
    await db.flush()
    return config


@router.post("/weights/{config_id}/set-default", response_model=WeightConfigOut)
async def set_default_weight_config(config_id: UUID, db: AsyncSession = Depends(get_db)):
    # Unset existing default
    await db.execute(update(WeightConfiguration).values(is_default=False))
    result = await db.execute(select(WeightConfiguration).where(WeightConfiguration.id == config_id))
    config = result.scalar_one_or_none()
    if not config:
        raise HTTPException(404, "Weight configuration not found")
    config.is_default = True
    await db.flush()
    return config


# ── Recompute ─────────────────────────────────────────────────────────────────


@router.post("/recompute")
async def recompute_scores(payload: RecomputeRequest, db: AsyncSession = Depends(get_db)):
    """Trigger async score recomputation. Returns a task ID for polling."""
    from apps.workers.tasks.score_compute import recompute_scores_task  # lazy import

    entity_ids = [str(e) for e in payload.entity_ids] if payload.entity_ids else None
    themes = payload.themes or ALL_THEMES
    weight_config_id = str(payload.weight_config_id) if payload.weight_config_id else None

    task = recompute_scores_task.delay(
        entity_ids=entity_ids,
        themes=themes,
        weight_config_id=weight_config_id,
    )
    return {"task_id": task.id}
