"""
Sentiment scoring for intelligence documents.

Uses a lightweight rule-based approach for MVP.
Post-MVP: swap in a fine-tuned FinBERT or similar transformer.
"""

from __future__ import annotations

import re

# High-signal geopolitical keywords mapped to risk direction
RISK_ESCALATION = {
    "war", "attack", "invasion", "strike", "bombing", "missiles", "conflict",
    "sanctions", "blockade", "coup", "assassination", "explosion", "casualties",
    "escalation", "airstrike", "siege", "occupation", "nuclear", "chemical",
    "crisis", "emergency", "collapse", "default", "embargo", "expulsion",
    "terrorism", "extremism", "insurgency", "massacre", "genocide",
}

RISK_DE_ESCALATION = {
    "ceasefire", "peace", "agreement", "treaty", "diplomacy", "negotiation",
    "withdrawal", "reconciliation", "normalization", "aid", "cooperation",
    "partnership", "investment", "growth", "stability", "recovery",
    "resolution", "dialogue", "truce", "accord", "summit",
}

RISK_NEUTRAL = {
    "meeting", "visit", "statement", "announcement", "report", "says",
    "election", "vote", "parliament", "legislation",
}


def score_sentiment(text: str) -> float:
    """
    Return a sentiment score in [-1.0, 1.0].
    -1.0 = strongly negative (high risk signal)
    +1.0 = strongly positive (de-escalation)
    """
    if not text:
        return 0.0

    words = set(re.findall(r"\b\w+\b", text.lower()))
    escalation_hits = len(words & RISK_ESCALATION)
    deescalation_hits = len(words & RISK_DE_ESCALATION)

    total = escalation_hits + deescalation_hits
    if total == 0:
        return 0.0

    # Negative = escalation → risk UP
    raw = (deescalation_hits - escalation_hits) / total
    return round(max(-1.0, min(1.0, raw)), 3)


def score_relevance(text: str, title: str = "") -> float:
    """
    Return 0.0-1.0 relevance score: how geopolitically relevant is this document?
    """
    combined = f"{title} {text}".lower()
    words = set(re.findall(r"\b\w+\b", combined))

    geopolitical_markers = {
        "country", "government", "military", "sanctions", "trade", "diplomat",
        "minister", "president", "policy", "border", "treaty", "war", "peace",
        "economy", "investment", "inflation", "gdp", "tariff", "export", "import",
        "security", "defense", "intelligence", "espionage", "nuclear", "oil",
        "energy", "supply", "chain", "sector", "market", "financial", "bank",
        "election", "parliament", "congress", "senate", "law", "regulation",
    }

    hits = len(words & geopolitical_markers)
    score = min(1.0, hits / 6)  # saturates at 6 keyword hits
    return round(score, 3)
