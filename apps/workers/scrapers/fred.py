"""FRED (Federal Reserve Economic Data) scraper for economic indicators."""

from __future__ import annotations

import logging
from datetime import datetime, timezone

from apps.api.config import settings
from apps.workers.scrapers.base import BaseScraper, RawDocument

log = logging.getLogger(__name__)

FRED_BASE = "https://api.stlouisfed.org/fred/series/observations"

# Key economic indicators mapped to geopolitical risk themes
FRED_SERIES: list[dict] = [
    {"id": "GDPC1", "name": "US Real GDP", "theme": "economic"},
    {"id": "CPIAUCSL", "name": "US CPI", "theme": "economic"},
    {"id": "DCOILWTICO", "name": "WTI Crude Oil Price", "theme": "trade"},
    {"id": "GOLDPMGBD228NLBM", "name": "Gold Price", "theme": "economic"},
    {"id": "DEXUSEU", "name": "USD/EUR Exchange Rate", "theme": "economic"},
    {"id": "DEXCHUS", "name": "CNY/USD Exchange Rate", "theme": "trade"},
    {"id": "UNRATE", "name": "US Unemployment Rate", "theme": "economic"},
]


class FredScraper(BaseScraper):
    SOURCE_TYPE = "financial"

    async def fetch(self) -> list[RawDocument]:
        if not settings.fred_api_key:
            log.warning("fred.no_api_key", msg="Skipping FRED ingestion — no API key configured")
            return []

        documents: list[RawDocument] = []
        for series in FRED_SERIES:
            try:
                response = await self.get(
                    FRED_BASE,
                    params={
                        "series_id": series["id"],
                        "api_key": settings.fred_api_key,
                        "file_type": "json",
                        "limit": 10,
                        "sort_order": "desc",
                    },
                )
                data = response.json()
                observations = data.get("observations", [])
                if not observations:
                    continue

                latest = observations[0]
                value = latest.get("value", ".")
                date = latest.get("date", "")

                body = (
                    f"Economic Indicator: {series['name']} (FRED: {series['id']}). "
                    f"Latest value: {value} as of {date}. "
                    f"Geopolitical theme: {series['theme']}."
                )

                documents.append(
                    RawDocument(
                        url=f"https://fred.stlouisfed.org/series/{series['id']}",
                        title=f"FRED: {series['name']} - {date}",
                        body_text=body,
                        source_type=self.SOURCE_TYPE,
                        published_at=f"{date}T00:00:00+00:00" if date else None,
                        metadata={
                            "series_id": series["id"],
                            "value": value,
                            "date": date,
                            "theme": series["theme"],
                            "source": "fred",
                        },
                    )
                )
            except Exception as exc:
                log.warning("fred.series_failed", series_id=series["id"], error=str(exc))

        log.info("fred.fetched", count=len(documents))
        return documents
