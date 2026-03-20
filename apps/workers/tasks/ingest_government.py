"""Government feed ingestion — OFAC SDN list, EU Journal."""

from __future__ import annotations

import asyncio
import logging

from sqlalchemy import select

from apps.api.database import AsyncSessionLocal
from apps.api.models import DataSource, IntelligenceDocument
from apps.workers.celery_app import celery_app
from apps.workers.nlp.entity_extractor import extract_entity_mentions, resolve_entities
from apps.workers.nlp.sentiment import score_relevance, score_sentiment
from apps.workers.scrapers.ofac import OfacScraper
from apps.workers.tasks.ingest_news import _get_entity_index

log = logging.getLogger(__name__)


async def _ingest_ofac():
    scraper = OfacScraper()
    raw_docs = await scraper.fetch()
    await scraper.close()

    async with AsyncSessionLocal() as db:
        result = await db.execute(select(DataSource).where(DataSource.name == "OFAC SDN List"))
        source = result.scalar_one_or_none()
        if not source:
            log.warning("ingest_gov.ofac_source_not_found")
            return 0

        hashes_result = await db.execute(select(IntelligenceDocument.content_hash))
        existing_hashes = {row[0] for row in hashes_result}
        entity_index = await _get_entity_index(db)

        new_count = 0
        for raw in raw_docs:
            if raw.content_hash in existing_hashes:
                continue

            mentions = extract_entity_mentions(f"{raw.title} {raw.body_text}")
            entity_ids = resolve_entities(mentions, entity_index)
            sentiment = score_sentiment(raw.body_text)
            relevance = score_relevance(raw.body_text, raw.title)

            doc = IntelligenceDocument(
                source_id=source.id,
                raw_url=raw.url,
                title=raw.title,
                body_text=raw.body_text,
                published_at=raw.published_at,
                source_type=raw.source_type,
                content_hash=raw.content_hash,
                entities_mentioned=entity_ids,
                sentiment_score=sentiment,
                relevance_score=max(relevance, 0.6),  # OFAC docs are inherently relevant
                metadata_=raw.metadata,
            )
            db.add(doc)
            existing_hashes.add(raw.content_hash)
            new_count += 1

        await db.commit()

    log.info("ingest_gov.ofac_completed", new_docs=new_count)
    return new_count


@celery_app.task(name="apps.workers.tasks.ingest_government.fetch_ofac_task", bind=True, max_retries=3)
def fetch_ofac_task(self):
    try:
        count = asyncio.get_event_loop().run_until_complete(_ingest_ofac())
        return {"source": "ofac_sdn", "new_documents": count}
    except Exception as exc:
        log.error("fetch_ofac_task.failed", error=str(exc))
        raise self.retry(exc=exc, countdown=120)


@celery_app.task(name="apps.workers.tasks.ingest_government.fetch_eu_journal_task", bind=True, max_retries=3)
def fetch_eu_journal_task(self):
    """EU Official Journal — uses the EU Journal RSS feed (delegated to RSS scraper)."""
    from apps.workers.tasks.ingest_news import fetch_rss_task
    return fetch_rss_task.apply(args=["eu_journal"]).get()
