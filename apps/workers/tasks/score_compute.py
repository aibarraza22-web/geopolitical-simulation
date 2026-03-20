"""
Score computation Celery task.

Triggered after ingestion events and on a periodic schedule.
Recomputes risk scores for affected entities.
"""

from __future__ import annotations

import asyncio
import logging
import uuid
from typing import Optional

from sqlalchemy import select

from apps.api.database import AsyncSessionLocal
from apps.api.models import Entity, WeightConfiguration
from apps.api.services.scoring import ALL_THEMES, compute_entity_theme_score, get_default_weight_config
from apps.workers.celery_app import celery_app

log = logging.getLogger(__name__)


async def _recompute(
    entity_ids: Optional[list[str]],
    themes: Optional[list[str]],
    weight_config_id: Optional[str],
) -> dict:
    async with AsyncSessionLocal() as db:
        # Resolve weight config
        weight_config = None
        if weight_config_id:
            result = await db.execute(
                select(WeightConfiguration).where(
                    WeightConfiguration.id == uuid.UUID(weight_config_id)
                )
            )
            weight_config = result.scalar_one_or_none()
        if not weight_config:
            weight_config = await get_default_weight_config(db)

        # Resolve entities
        if entity_ids:
            entity_uuids = [uuid.UUID(e) for e in entity_ids]
            result = await db.execute(select(Entity).where(Entity.id.in_(entity_uuids)))
        else:
            result = await db.execute(select(Entity).where(Entity.type.in_(["country", "sector"])))

        entities = result.scalars().all()
        target_themes = themes or ALL_THEMES

        computed = 0
        for entity in entities:
            for theme in target_themes:
                try:
                    await compute_entity_theme_score(db, entity.id, theme, weight_config)
                    computed += 1
                except Exception as exc:
                    log.warning(
                        "score_compute.entity_failed",
                        entity_id=str(entity.id),
                        theme=theme,
                        error=str(exc),
                    )

        await db.commit()
        log.info("score_compute.completed", computed=computed, entities=len(entities))
        return {"computed": computed, "entities": len(entities)}


@celery_app.task(
    name="apps.workers.tasks.score_compute.recompute_scores_task",
    bind=True,
    max_retries=2,
)
def recompute_scores_task(
    self,
    entity_ids: Optional[list[str]] = None,
    themes: Optional[list[str]] = None,
    weight_config_id: Optional[str] = None,
):
    try:
        result = asyncio.get_event_loop().run_until_complete(
            _recompute(entity_ids, themes, weight_config_id)
        )
        return result
    except Exception as exc:
        log.error("recompute_scores_task.failed", error=str(exc))
        raise self.retry(exc=exc, countdown=30)
