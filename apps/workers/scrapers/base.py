"""
Base scraper with retry logic, rate limiting, and deduplication.
All source-specific scrapers inherit from BaseScraper.
"""

from __future__ import annotations

import hashlib
import logging
from abc import ABC, abstractmethod
from typing import Optional

import httpx
from tenacity import retry, stop_after_attempt, wait_exponential

log = logging.getLogger(__name__)


class RawDocument:
    """Normalized raw document before NLP processing."""

    def __init__(
        self,
        url: str,
        title: str,
        body_text: str,
        source_type: str,
        published_at: Optional[str] = None,
        metadata: Optional[dict] = None,
    ):
        self.url = url
        self.title = title
        self.body_text = body_text
        self.source_type = source_type
        self.published_at = published_at
        self.metadata = metadata or {}
        self.content_hash = self._hash()

    def _hash(self) -> str:
        content = f"{self.url}|{self.title}|{self.body_text[:500]}"
        return hashlib.sha256(content.encode()).hexdigest()


class BaseScraper(ABC):
    """
    Base class for all data source scrapers.

    Subclasses implement `fetch()` which returns a list of RawDocument.
    The base class handles HTTP retries and provides a shared HTTP client.
    """

    SOURCE_TYPE: str = "unknown"
    DEFAULT_TIMEOUT = 30

    def __init__(self):
        self._client: Optional[httpx.AsyncClient] = None

    async def client(self) -> httpx.AsyncClient:
        if self._client is None or self._client.is_closed:
            self._client = httpx.AsyncClient(
                timeout=self.DEFAULT_TIMEOUT,
                headers={"User-Agent": "GeoRisk-Intelligence-Bot/1.0"},
                follow_redirects=True,
            )
        return self._client

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=2, max=30),
        reraise=True,
    )
    async def get(self, url: str, **kwargs) -> httpx.Response:
        c = await self.client()
        response = await c.get(url, **kwargs)
        response.raise_for_status()
        return response

    @abstractmethod
    async def fetch(self) -> list[RawDocument]:
        """Return a list of raw documents from this source."""
        ...

    async def close(self):
        if self._client and not self._client.is_closed:
            await self._client.aclose()
