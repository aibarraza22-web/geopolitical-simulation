"""
News ingestion tasks — RSS feeds and general news sources.
"""

from __future__ import annotations

import asyncio
import logging
import uuid
from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from apps.api.database import AsyncSessionLocal
from apps.api.models import DataSource, Entity, IntelligenceDocument
from apps.workers.celery_app import celery_app
from apps.workers.nlp.entity_extractor import extract_entity_mentions, resolve_entities
from apps.workers.nlp.sentiment import score_relevance, score_sentiment
from apps.workers.scrapers.rss import RSS_SOURCES, RssScraper

log = logging.getLogger(__name__)


async def _get_entity_index(db: AsyncSession) -> dict[str, str]:
    """Build name→entity_id index from all entities and their aliases."""
    result = await db.execute(select(Entity))
    entities = result.scalars().all()
    index: dict[str, str] = {}
    for entity in entities:
        index[entity.name.lower()] = str(entity.id)
        for alias in entity.aliases or []:
            index[alias.lower()] = str(entity.id)
    return index


async def _ingest_documents(source_name: str, scraper_key: str) -> int:
    """Fetch, process, and persist documents for a given RSS source."""
    scraper = RssScraper(scraper_key)
    raw_docs = await scraper.fetch()
    await scraper.close()

    if not raw_docs:
        return 0

    async with AsyncSessionLocal() as db:
        # Get source record
        result = await db.execute(select(DataSource).where(DataSource.name == source_name))
        source = result.scalar_one_or_none()
        if not source:
            log.warning("ingest.source_not_found", name=source_name)
            return 0

        # Get existing hashes for deduplication
        hashes_result = await db.execute(
            select(IntelligenceDocument.content_hash)
        )
        existing_hashes = {row[0] for row in hashes_result}

        entity_index = await _get_entity_index(db)

        new_count = 0
        for raw in raw_docs:
            if raw.content_hash in existing_hashes:
                continue

            # NLP processing
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
                relevance_score=relevance,
                metadata_=raw.metadata,
            )
            db.add(doc)
            existing_hashes.add(raw.content_hash)
            new_count += 1

        await db.commit()

        # Trigger score recompute for affected entities
        if entity_ids:
            from apps.workers.tasks.score_compute import recompute_scores_task
            recompute_scores_task.delay(entity_ids=list(set(entity_ids)), themes=None, weight_config_id=None)

    log.info("ingest.completed", source=source_name, new_docs=new_count)
    return new_count


@celery_app.task(name="apps.workers.tasks.ingest_news.fetch_rss_task", bind=True, max_retries=3)
def fetch_rss_task(self, source_key: str):
    """Celery task: fetch and ingest one RSS source."""
    config = RSS_SOURCES.get(source_key, {})
    source_name = config.get("name", source_key)
    try:
        count = asyncio.get_event_loop().run_until_complete(
            _ingest_documents(source_name, source_key)
        )
        return {"source": source_key, "new_documents": count}
    except Exception as exc:
        log.error("fetch_rss_task.failed", source=source_key, error=str(exc))
        raise self.retry(exc=exc, countdown=60)


@celery_app.task(name="apps.workers.tasks.ingest_news.fetch_source_task", bind=True)
def fetch_source_task(self, source_id: str):
    """Manually trigger fetch for a specific source by ID."""
    async def _run():
        async with AsyncSessionLocal() as db:
            result = await db.execute(
                select(DataSource).where(DataSource.id == uuid.UUID(source_id))
            )
            source = result.scalar_one_or_none()
            if not source:
                return {"error": "source not found"}

        source_key = source.config.get("source_key", "")
        if source_key in RSS_SOURCES:
            return await _ingest_documents(source.name, source_key)
        return {"error": f"No scraper for source_key: {source_key}"}

    return asyncio.get_event_loop().run_until_complete(_run())
