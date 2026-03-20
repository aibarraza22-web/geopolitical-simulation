"""RSS feed scraper — covers Reuters, BBC, UN Press, and any generic RSS source."""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
from typing import Optional

import feedparser
import trafilatura

from apps.workers.scrapers.base import BaseScraper, RawDocument

log = logging.getLogger(__name__)

RSS_SOURCES: dict[str, dict] = {
    "reuters": {
        "name": "Reuters",
        "urls": [
            "https://feeds.reuters.com/reuters/topNews",
            "https://feeds.reuters.com/reuters/worldNews",
        ],
        "reliability": 0.90,
    },
    "bbc": {
        "name": "BBC World",
        "urls": [
            "http://feeds.bbci.co.uk/news/world/rss.xml",
            "http://feeds.bbci.co.uk/news/politics/rss.xml",
        ],
        "reliability": 0.88,
    },
    "un_press": {
        "name": "UN Press Releases",
        "urls": ["https://press.un.org/en/rss.xml"],
        "reliability": 0.95,
    },
    "reliefweb": {
        "name": "ReliefWeb",
        "urls": ["https://reliefweb.int/updates/rss.xml"],
        "reliability": 0.82,
    },
    "eu_journal": {
        "name": "EU Official Journal",
        "urls": ["https://eur-lex.europa.eu/oj/direct-access.html?ojSeries=OJ_L"],
        "reliability": 0.95,
    },
}


def _parse_date(entry) -> Optional[str]:
    for field in ("published", "updated"):
        raw = entry.get(field)
        if raw:
            try:
                dt = parsedate_to_datetime(raw)
                return dt.isoformat()
            except Exception:
                pass
    return None


def _extract_body(entry) -> str:
    """Extract body text from RSS entry, falling back to summary."""
    content = entry.get("content", [{}])
    if content:
        html = content[0].get("value", "")
        if html:
            extracted = trafilatura.extract(html)
            if extracted:
                return extracted

    summary = entry.get("summary", "")
    if summary:
        extracted = trafilatura.extract(summary)
        return extracted or summary

    return ""


class RssScraper(BaseScraper):
    SOURCE_TYPE = "rss"

    def __init__(self, source_key: str):
        super().__init__()
        self.source_key = source_key
        self.source_config = RSS_SOURCES.get(source_key, {})
        self.urls: list[str] = self.source_config.get("urls", [])

    async def fetch(self) -> list[RawDocument]:
        documents: list[RawDocument] = []

        for url in self.urls:
            try:
                response = await self.get(url)
                feed = feedparser.parse(response.text)

                for entry in feed.entries[:50]:  # cap at 50 per feed
                    link = entry.get("link", "")
                    title = entry.get("title", "Untitled")
                    body = _extract_body(entry)
                    published = _parse_date(entry)

                    if not link or not title:
                        continue

                    documents.append(
                        RawDocument(
                            url=link,
                            title=title,
                            body_text=body,
                            source_type=self.SOURCE_TYPE,
                            published_at=published,
                            metadata={
                                "source_key": self.source_key,
                                "feed_url": url,
                                "tags": [t.get("term", "") for t in entry.get("tags", [])],
                            },
                        )
                    )
            except Exception as exc:
                log.warning("rss.fetch_failed", url=url, error=str(exc))

        log.info("rss.fetched", source=self.source_key, count=len(documents))
        return documents
