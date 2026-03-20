"""
NLP entity extraction pipeline.

Uses spaCy for NER, then links extracted entities to the Entity table
via fuzzy string matching (rapidfuzz).
"""

from __future__ import annotations

import logging
from functools import lru_cache
from typing import Optional

log = logging.getLogger(__name__)

try:
    import spacy

    @lru_cache(maxsize=1)
    def _load_nlp():
        try:
            return spacy.load("en_core_web_sm")
        except OSError:
            log.warning("spacy.model_missing", msg="en_core_web_sm not found, using blank model")
            return spacy.blank("en")

except ImportError:
    log.warning("spacy.not_installed")
    _load_nlp = None  # type: ignore


def extract_entity_mentions(text: str) -> list[dict]:
    """
    Run spaCy NER over text and return a list of {text, label, start, end} dicts.
    Returns empty list if spaCy is unavailable or text is too short.
    """
    if _load_nlp is None or not text or len(text) < 20:
        return []

    nlp = _load_nlp()
    doc = nlp(text[:10_000])  # cap to avoid memory issues
    mentions = []
    for ent in doc.ents:
        if ent.label_ in ("GPE", "LOC", "ORG", "PERSON", "NORP"):
            mentions.append(
                {
                    "text": ent.text,
                    "label": ent.label_,
                    "start": ent.start_char,
                    "end": ent.end_char,
                }
            )
    return mentions


def resolve_entities(mentions: list[dict], entity_index: dict[str, str]) -> list[str]:
    """
    Link extracted mentions to known entity IDs using fuzzy matching.

    entity_index: {canonical_name_or_alias: entity_id_str}
    Returns a deduplicated list of entity_id strings.
    """
    try:
        from rapidfuzz import process, fuzz
    except ImportError:
        log.warning("rapidfuzz.not_installed")
        return []

    if not entity_index:
        return []

    resolved_ids: set[str] = set()
    choices = list(entity_index.keys())

    for mention in mentions:
        text = mention["text"]
        if len(text) < 3:
            continue

        match = process.extractOne(
            text,
            choices,
            scorer=fuzz.WRatio,
            score_cutoff=82,
        )
        if match:
            best_name, score, _ = match
            entity_id = entity_index[best_name]
            resolved_ids.add(entity_id)

    return list(resolved_ids)
