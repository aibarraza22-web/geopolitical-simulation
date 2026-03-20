"""Scenario simulation Celery task."""

from __future__ import annotations

import asyncio
import logging
import uuid

from apps.api.database import AsyncSessionLocal
from apps.api.services.scenario import run_scenario
from apps.workers.celery_app import celery_app

log = logging.getLogger(__name__)


@celery_app.task(
    name="apps.workers.tasks.scenario_runner.run_scenario_task",
    bind=True,
    max_retries=1,
    time_limit=120,
)
def run_scenario_task(self, scenario_id: str):
    async def _run():
        async with AsyncSessionLocal() as db:
            scenario = await run_scenario(db, uuid.UUID(scenario_id))
            await db.commit()
            return {"scenario_id": scenario_id, "status": scenario.status}

    try:
        return asyncio.get_event_loop().run_until_complete(_run())
    except Exception as exc:
        log.error("run_scenario_task.failed", scenario_id=scenario_id, error=str(exc))
        raise self.retry(exc=exc)
