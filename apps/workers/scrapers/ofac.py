"""OFAC SDN List scraper — downloads the XML and extracts sanctioned entities."""

from __future__ import annotations

import logging
import xml.etree.ElementTree as ET
from datetime import datetime, timezone

from apps.workers.scrapers.base import BaseScraper, RawDocument

log = logging.getLogger(__name__)

OFAC_SDN_URL = "https://www.treasury.gov/ofac/downloads/sdn.xml"
NS = {"ofac": "http://www.un.org/sanctions/1.0"}


class OfacScraper(BaseScraper):
    SOURCE_TYPE = "government"

    async def fetch(self) -> list[RawDocument]:
        try:
            response = await self.get(OFAC_SDN_URL)
        except Exception as exc:
            log.error("ofac.fetch_failed", error=str(exc))
            return []

        documents: list[RawDocument] = []
        try:
            root = ET.fromstring(response.content)
            # SDN entries have various structures — extract names and programs
            for entry in root.iter("sdnEntry"):
                uid = entry.findtext("uid", "")
                first_name = entry.findtext("firstName", "") or ""
                last_name = entry.findtext("lastName", "") or ""
                entity_type = entry.findtext("sdnType", "")
                programs = [p.text for p in entry.findall("programList/program") if p.text]
                programs_str = ", ".join(programs)

                name = f"{first_name} {last_name}".strip() or f"SDN-{uid}"
                body = (
                    f"OFAC SDN Entry: {name}. Type: {entity_type}. "
                    f"Programs: {programs_str}. UID: {uid}."
                )

                documents.append(
                    RawDocument(
                        url=f"https://sanctionssearch.ofac.treas.gov/Details.aspx?id={uid}",
                        title=f"OFAC SDN: {name}",
                        body_text=body,
                        source_type=self.SOURCE_TYPE,
                        published_at=datetime.now(timezone.utc).isoformat(),
                        metadata={
                            "uid": uid,
                            "entity_type": entity_type,
                            "programs": programs,
                            "source": "ofac_sdn",
                        },
                    )
                )
        except ET.ParseError as exc:
            log.error("ofac.parse_failed", error=str(exc))

        log.info("ofac.fetched", count=len(documents))
        return documents
