"""Alert evaluation and dispatch — runs after score computation."""

from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timezone

import httpx
from sqlalchemy import select

from apps.api.database import AsyncSessionLocal
from apps.api.models import AlertEvent, AlertRule, RiskScore
from apps.workers.celery_app import celery_app

log = logging.getLogger(__name__)


def _condition_met(rule: AlertRule, score: RiskScore) -> bool:
    if rule.condition == "score_above":
        return score.score > rule.threshold
    if rule.condition == "score_below":
        return score.score < rule.threshold
    if rule.condition == "delta_above" and score.score_delta_7d is not None:
        return score.score_delta_7d > rule.threshold
    if rule.condition == "delta_below" and score.score_delta_7d is not None:
        return score.score_delta_7d < rule.threshold
    return False


async def _dispatch_alerts():
    async with AsyncSessionLocal() as db:
        rules_result = await db.execute(select(AlertRule).where(AlertRule.is_active == True))  # noqa: E712
        rules = rules_result.scalars().all()

        scores_result = await db.execute(
            select(RiskScore).where(RiskScore.is_current == True)  # noqa: E712
        )
        current_scores = scores_result.scalars().all()

        triggered = 0
        for rule in rules:
            for score in current_scores:
                if rule.entity_id and rule.entity_id != score.entity_id:
                    continue
                if rule.theme and rule.theme != score.theme:
                    continue
                if _condition_met(rule, score):
                    event = AlertEvent(
                        rule_id=rule.id,
                        entity_id=score.entity_id,
                        theme=score.theme,
                        triggered_score=score.score,
                        threshold=rule.threshold,
                    )
                    db.add(event)
                    rule.last_triggered_at = datetime.now(timezone.utc)
                    triggered += 1

                    # Webhook delivery
                    if "webhook" in (rule.delivery_channels or []) and rule.webhook_url:
                        try:
                            async with httpx.AsyncClient(timeout=10) as client:
                                await client.post(
                                    rule.webhook_url,
                                    json={
                                        "rule_id": str(rule.id),
                                        "rule_name": rule.name,
                                        "entity_id": str(score.entity_id),
                                        "theme": score.theme,
                                        "score": score.score,
                                        "threshold": rule.threshold,
                                        "condition": rule.condition,
                                    },
                                )
                        except Exception as exc:
                            log.warning("alert.webhook_failed", url=rule.webhook_url, error=str(exc))

        await db.commit()
        log.info("alert_dispatch.completed", triggered=triggered)
        return {"triggered": triggered}


@celery_app.task(name="apps.workers.tasks.alert_dispatch.dispatch_alerts_task")
def dispatch_alerts_task():
    return asyncio.get_event_loop().run_until_complete(_dispatch_alerts())
