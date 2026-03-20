"""
Seed script: populate Entity table with countries (ISO 3166-1) and GICS sectors.
Run: python -m infra.scripts.seed_entities
"""

import asyncio
import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from apps.api.database import AsyncSessionLocal
from apps.api.models import Entity

# ISO 3166-1 alpha-2 — name, iso_code, aliases
COUNTRIES = [
    ("United States", "US", ["USA", "America", "United States of America"]),
    ("Russia", "RU", ["Russian Federation", "RF", "Soviet Union"]),
    ("China", "CN", ["PRC", "People's Republic of China", "Mainland China"]),
    ("Germany", "DE", ["Deutschland", "Federal Republic of Germany"]),
    ("United Kingdom", "GB", ["UK", "Britain", "Great Britain", "England"]),
    ("France", "FR", ["French Republic"]),
    ("Japan", "JP", ["Nippon", "Nihon"]),
    ("India", "IN", ["Republic of India", "Bharat"]),
    ("Brazil", "BR", ["Brasil", "Federative Republic of Brazil"]),
    ("Canada", "CA", []),
    ("Australia", "AU", []),
    ("South Korea", "KR", ["Republic of Korea", "ROK"]),
    ("Italy", "IT", ["Italian Republic"]),
    ("Spain", "ES", ["Kingdom of Spain"]),
    ("Mexico", "MX", ["United Mexican States"]),
    ("Indonesia", "ID", []),
    ("Netherlands", "NL", ["Holland"]),
    ("Saudi Arabia", "SA", ["KSA", "Kingdom of Saudi Arabia"]),
    ("Turkey", "TR", ["Türkiye", "Republic of Turkey"]),
    ("Switzerland", "CH", ["Helvetia"]),
    ("Iran", "IR", ["Islamic Republic of Iran", "Persia"]),
    ("North Korea", "KP", ["DPRK", "Democratic People's Republic of Korea"]),
    ("Ukraine", "UA", []),
    ("Israel", "IL", ["State of Israel"]),
    ("Poland", "PL", [],),
    ("Sweden", "SE", []),
    ("Norway", "NO", []),
    ("South Africa", "ZA", ["RSA"]),
    ("Nigeria", "NG", []),
    ("Egypt", "EG", ["Arab Republic of Egypt"]),
    ("Pakistan", "PK", ["Islamic Republic of Pakistan"]),
    ("Afghanistan", "AF", []),
    ("Iraq", "IQ", []),
    ("Syria", "SY", ["Syrian Arab Republic"]),
    ("Venezuela", "VE", []),
    ("Cuba", "CU", []),
    ("Myanmar", "MM", ["Burma"]),
    ("Ethiopia", "ET", []),
    ("Libya", "LY", []),
    ("Yemen", "YE", []),
    ("Taiwan", "TW", ["Republic of China", "ROC"]),
    ("Singapore", "SG", []),
    ("Malaysia", "MY", []),
    ("Thailand", "TH", []),
    ("Vietnam", "VN", []),
    ("Philippines", "PH", []),
    ("Argentina", "AR", []),
    ("Colombia", "CO", []),
    ("Chile", "CL", []),
    ("Peru", "PE", []),
]

# GICS Sectors
SECTORS = [
    ("Energy", "energy", ["Oil & Gas", "Petroleum"]),
    ("Materials", "materials", ["Mining", "Chemicals", "Metals"]),
    ("Industrials", "industrials", ["Defense", "Manufacturing", "Aerospace"]),
    ("Consumer Discretionary", "consumer_disc", ["Retail", "Automotive"]),
    ("Consumer Staples", "consumer_staples", ["Food", "Beverages"]),
    ("Health Care", "health_care", ["Pharmaceuticals", "Biotech", "Healthcare"]),
    ("Financials", "financials", ["Banking", "Insurance", "Finance"]),
    ("Information Technology", "information_tech", ["Technology", "Software", "Semiconductors", "Tech"]),
    ("Communication Services", "comm_services", ["Telecom", "Media"]),
    ("Utilities", "utilities", []),
    ("Real Estate", "real_estate", ["Property"]),
    ("Defense", "defense", ["Military", "Arms", "Weapons"]),
]


async def seed(db: AsyncSession):
    print("Seeding entities...")

    # Countries
    country_count = 0
    for name, iso, aliases in COUNTRIES:
        entity = Entity(
            id=uuid.uuid4(),
            type="country",
            name=name,
            iso_code=iso,
            aliases=[a.lower() for a in [name.lower()] + aliases],
            metadata_={"iso_alpha2": iso},
        )
        db.add(entity)
        country_count += 1

    # Sectors
    sector_count = 0
    for name, code, aliases in SECTORS:
        entity = Entity(
            id=uuid.uuid4(),
            type="sector",
            name=name,
            iso_code=code,
            aliases=[a.lower() for a in [name.lower()] + aliases],
            metadata_={"gics_code": code},
        )
        db.add(entity)
        sector_count += 1

    await db.commit()
    print(f"Seeded {country_count} countries and {sector_count} sectors.")


async def main():
    async with AsyncSessionLocal() as db:
        await seed(db)


if __name__ == "__main__":
    asyncio.run(main())
