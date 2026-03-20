"""Financial data ingestion — FRED, World Bank."""

from __future__ import annotations

import asyncio
import logging

from sqlalchemy import select

from apps.api.database import AsyncSessionLocal
from apps.api.models import DataSource, IntelligenceDocument
from apps.workers.celery_app import celery_app
from apps.workers.nlp.sentiment import score_relevance, score_sentiment
from apps.workers.scrapers.fred import FredScraper

log = logging.getLogger(__name__)


async def _ingest_fred():
    scraper = FredScraper()
    raw_docs = await scraper.fetch()
    await scraper.close()

    async with AsyncSessionLocal() as db:
        result = await db.execute(select(DataSource).where(DataSource.name == "FRED"))
        source = result.scalar_one_or_none()
        if not source:
            log.warning("ingest_fin.fred_source_not_found")
            return 0

        hashes_result = await db.execute(select(IntelligenceDocument.content_hash))
        existing_hashes = {row[0] for row in hashes_result}

        new_count = 0
        for raw in raw_docs:
            if raw.content_hash in existing_hashes:
                continue
            doc = IntelligenceDocument(
                source_id=source.id,
                raw_url=raw.url,
                title=raw.title,
                body_text=raw.body_text,
                published_at=raw.published_at,
                source_type=raw.source_type,
                content_hash=raw.content_hash,
                entities_mentioned=[],  # financial docs link to sectors, not countries directly
                sentiment_score=score_sentiment(raw.body_text),
                relevance_score=score_relevance(raw.body_text, raw.title),
                metadata_=raw.metadata,
            )
            db.add(doc)
            existing_hashes.add(raw.content_hash)
            new_count += 1

        await db.commit()

    log.info("ingest_fin.fred_completed", new_docs=new_count)
    return new_count


@celery_app.task(name="apps.workers.tasks.ingest_financial.fetch_fred_task", bind=True, max_retries=3)
def fetch_fred_task(self):
    try:
        count = asyncio.get_event_loop().run_until_complete(_ingest_fred())
        return {"source": "fred", "new_documents": count}
    except Exception as exc:
        log.error("fetch_fred_task.failed", error=str(exc))
        raise self.retry(exc=exc, countdown=60)


@celery_app.task(name="apps.workers.tasks.ingest_financial.fetch_world_bank_task", bind=True)
def fetch_world_bank_task(self):
    """World Bank data — MVP stub; real implementation fetches country indicators via WB API."""
    log.info("fetch_world_bank_task.stub", msg="World Bank ingestion not yet implemented")
    return {"source": "world_bank", "new_documents": 0}
