from celery import Celery
from celery.schedules import crontab

from apps.api.config import settings

celery_app = Celery(
    "georisk",
    broker=settings.celery_broker_url,
    backend=settings.celery_result_backend,
    include=[
        "apps.workers.tasks.ingest_news",
        "apps.workers.tasks.ingest_government",
        "apps.workers.tasks.ingest_financial",
        "apps.workers.tasks.entity_resolution",
        "apps.workers.tasks.score_compute",
        "apps.workers.tasks.alert_dispatch",
        "apps.workers.tasks.scenario_runner",
    ],
)

celery_app.conf.update(
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
    task_soft_time_limit=300,
    task_time_limit=600,
    worker_prefetch_multiplier=1,
)

# ── Scheduled ingestion tasks (Celery Beat) ─────────────────────────────────
celery_app.conf.beat_schedule = {
    # News sources — every 15 minutes
    "ingest-rss-reuters": {
        "task": "apps.workers.tasks.ingest_news.fetch_rss_task",
        "schedule": crontab(minute="*/15"),
        "args": ["reuters"],
    },
    "ingest-rss-bbc": {
        "task": "apps.workers.tasks.ingest_news.fetch_rss_task",
        "schedule": crontab(minute="*/15"),
        "args": ["bbc"],
    },
    "ingest-rss-un": {
        "task": "apps.workers.tasks.ingest_news.fetch_rss_task",
        "schedule": crontab(minute="*/30"),
        "args": ["un_press"],
    },
    # Government / sanctions — daily
    "ingest-ofac": {
        "task": "apps.workers.tasks.ingest_government.fetch_ofac_task",
        "schedule": crontab(hour="6", minute="0"),
    },
    "ingest-eu-journal": {
        "task": "apps.workers.tasks.ingest_government.fetch_eu_journal_task",
        "schedule": crontab(hour="7", minute="0"),
    },
    # Financial data — every 6 hours
    "ingest-fred": {
        "task": "apps.workers.tasks.ingest_financial.fetch_fred_task",
        "schedule": crontab(minute="0", hour="*/6"),
    },
    "ingest-world-bank": {
        "task": "apps.workers.tasks.ingest_financial.fetch_world_bank_task",
        "schedule": crontab(hour="4", minute="0"),
    },
    # Periodic full score recompute — every hour
    "recompute-all-scores": {
        "task": "apps.workers.tasks.score_compute.recompute_scores_task",
        "schedule": crontab(minute="5"),
        "kwargs": {"entity_ids": None, "themes": None, "weight_config_id": None},
    },
}
