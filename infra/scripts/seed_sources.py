"""
Seed script: register public data sources in the DataSource table.
Run: python -m infra.scripts.seed_sources
"""

import asyncio
import uuid

from apps.api.database import AsyncSessionLocal
from apps.api.models import DataSource
from apps.api.services.scoring import DEFAULT_WEIGHTS
from apps.api.models import WeightConfiguration


DATA_SOURCES = [
    {
        "name": "Reuters",
        "source_type": "rss",
        "endpoint_url": "https://feeds.reuters.com/reuters/worldNews",
        "fetch_interval_seconds": 900,
        "reliability_score": 0.90,
        "config": {"source_key": "reuters"},
    },
    {
        "name": "BBC World",
        "source_type": "rss",
        "endpoint_url": "http://feeds.bbci.co.uk/news/world/rss.xml",
        "fetch_interval_seconds": 900,
        "reliability_score": 0.88,
        "config": {"source_key": "bbc"},
    },
    {
        "name": "UN Press Releases",
        "source_type": "rss",
        "endpoint_url": "https://press.un.org/en/rss.xml",
        "fetch_interval_seconds": 1800,
        "reliability_score": 0.95,
        "config": {"source_key": "un_press"},
    },
    {
        "name": "OFAC SDN List",
        "source_type": "file_feed",
        "endpoint_url": "https://www.treasury.gov/ofac/downloads/sdn.xml",
        "fetch_interval_seconds": 86400,
        "reliability_score": 0.99,
        "config": {"source_key": "ofac"},
    },
    {
        "name": "EU Official Journal",
        "source_type": "rss",
        "endpoint_url": "https://eur-lex.europa.eu/oj/direct-access.html",
        "fetch_interval_seconds": 86400,
        "reliability_score": 0.95,
        "config": {"source_key": "eu_journal"},
    },
    {
        "name": "FRED",
        "source_type": "api",
        "endpoint_url": "https://api.stlouisfed.org/fred",
        "fetch_interval_seconds": 21600,
        "reliability_score": 0.97,
        "config": {"source_key": "fred"},
    },
    {
        "name": "World Bank",
        "source_type": "api",
        "endpoint_url": "https://api.worldbank.org/v2",
        "fetch_interval_seconds": 86400,
        "reliability_score": 0.95,
        "config": {"source_key": "world_bank"},
    },
    {
        "name": "ReliefWeb",
        "source_type": "rss",
        "endpoint_url": "https://reliefweb.int/updates/rss.xml",
        "fetch_interval_seconds": 1800,
        "reliability_score": 0.82,
        "config": {"source_key": "reliefweb"},
    },
]


async def main():
    async with AsyncSessionLocal() as db:
        print("Seeding data sources...")
        for s in DATA_SOURCES:
            source = DataSource(id=uuid.uuid4(), **s)
            db.add(source)
        print(f"Seeded {len(DATA_SOURCES)} data sources.")

        print("Seeding default weight configuration...")
        default_config = WeightConfiguration(
            id=uuid.uuid4(),
            name="Default Baseline Configuration",
            is_default=True,
            weights=DEFAULT_WEIGHTS,
            version=1,
        )
        db.add(default_config)
        print("Seeded default weight configuration.")

        await db.commit()
        print("Done.")


if __name__ == "__main__":
    asyncio.run(main())
