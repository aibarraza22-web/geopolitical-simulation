"""
Risk Scoring Engine.

Computes (entity, theme) risk scores from IntelligenceDocuments using
analyst-configurable WeightConfigurations.
"""

from __future__ import annotations

import math
import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from apps.api.models import Entity, IntelligenceDocument, RiskScore, WeightConfiguration

# Default weight configuration — analysts override these at runtime.
DEFAULT_WEIGHTS: dict[str, dict[str, float]] = {
    "conflict": {
        "military_activity": 0.40,
        "political_instability": 0.35,
        "border_tension": 0.25,
    },
    "sanctions": {
        "ofac_listings": 0.50,
        "un_resolutions": 0.30,
        "news_sentiment": 0.20,
    },
    "political": {
        "election_risk": 0.40,
        "regime_stability": 0.40,
        "protest_activity": 0.20,
    },
    "economic": {
        "gdp_growth": 0.30,
        "inflation": 0.30,
        "debt_level": 0.20,
        "trade_balance": 0.20,
    },
    "regulatory": {
        "policy_change": 0.50,
        "enforcement_action": 0.30,
        "compliance_risk": 0.20,
    },
    "supply_chain": {
        "logistics_disruption": 0.40,
        "input_shortage": 0.35,
        "infrastructure_risk": 0.25,
    },
    "trade": {
        "tariff_change": 0.35,
        "export_control": 0.35,
        "partner_risk": 0.30,
    },
}

# How far back to look for documents per theme (hours)
RELEVANCE_WINDOWS: dict[str, int] = {
    "conflict": 72,
    "sanctions": 168,
    "political": 120,
    "economic": 720,
    "regulatory": 240,
    "supply_chain": 168,
    "trade": 240,
}

ALL_THEMES = list(DEFAULT_WEIGHTS.keys())


def _sigmoid_normalize(raw: float, scale: float = 0.05, midpoint: float = 0.0) -> float:
    """Map raw signal [-1, 1] to [0, 100] risk score via sigmoid."""
    sigmoid = 1 / (1 + math.exp(-scale * (raw - midpoint)))
    return round(sigmoid * 100, 2)


def _compute_confidence(doc_count: int, source_ids: set, recency_weights: list[float]) -> float:
    """
    Confidence = f(document volume, source diversity, recency).
    Returns 0.0-1.0.
    """
    volume_score = min(1.0, doc_count / 10)  # saturates at 10 docs
    diversity_score = min(1.0, len(source_ids) / 3)  # saturates at 3 distinct sources
    recency_score = (sum(recency_weights) / len(recency_weights)) if recency_weights else 0.0
    return round((volume_score * 0.4 + diversity_score * 0.3 + recency_score * 0.3), 3)


async def compute_entity_theme_score(
    db: AsyncSession,
    entity_id: uuid.UUID,
    theme: str,
    weight_config: Optional[WeightConfiguration] = None,
) -> RiskScore:
    """
    Compute and persist a new RiskScore for a single (entity, theme) pair.
    Marks the previous score as not current.
    """
    weights = weight_config.weights if weight_config else DEFAULT_WEIGHTS
    theme_weights = weights.get(theme, DEFAULT_WEIGHTS.get(theme, {}))

    # Query recent documents mentioning this entity
    window_hours = RELEVANCE_WINDOWS.get(theme, 168)
    cutoff = datetime.now(timezone.utc) - timedelta(hours=window_hours)

    result = await db.execute(
        select(IntelligenceDocument)
        .where(
            IntelligenceDocument.ingested_at >= cutoff,
            IntelligenceDocument.relevance_score >= 0.3,
            IntelligenceDocument.entities_mentioned.contains([str(entity_id)]),
        )
        .order_by(IntelligenceDocument.published_at.desc())
        .limit(100)
    )
    documents = result.scalars().all()

    if not documents:
        raw_signal = 0.0
        source_ids: set = set()
        recency_weights: list[float] = []
        signal_breakdown: dict = {}
        top_doc_ids: list = []
        confidence = 0.1
    else:
        now = datetime.now(timezone.utc)
        source_ids = {str(doc.source_id) for doc in documents}
        top_doc_ids = [str(doc.id) for doc in documents[:5]]

        # Aggregate signals per category using sentiment + relevance + recency
        category_signals: dict[str, list[float]] = {k: [] for k in theme_weights}
        recency_weights = []

        for doc in documents:
            sentiment = doc.sentiment_score or 0.0
            relevance = doc.relevance_score or 0.5

            # Invert sentiment: negative sentiment = higher risk
            risk_signal = -sentiment * relevance

            age_hours = (now - doc.ingested_at.replace(tzinfo=timezone.utc)).total_seconds() / 3600
            recency_weight = max(0.0, 1.0 - (age_hours / window_hours))
            recency_weights.append(recency_weight)

            weighted_signal = risk_signal * recency_weight

            # Distribute signal across theme categories (simplified: all docs contribute equally)
            for category in category_signals:
                category_signals[category].append(weighted_signal)

        # Compute per-category aggregate
        category_scores: dict[str, float] = {}
        for category, signals in category_signals.items():
            if signals:
                category_scores[category] = sum(signals) / len(signals)
            else:
                category_scores[category] = 0.0

        signal_breakdown = {k: round(v, 4) for k, v in category_scores.items()}

        # Weighted composite
        total_weight = sum(theme_weights.values()) or 1.0
        raw_signal = sum(
            category_scores.get(cat, 0.0) * (w / total_weight)
            for cat, w in theme_weights.items()
        )

        confidence = _compute_confidence(len(documents), source_ids, recency_weights)

    score = _sigmoid_normalize(raw_signal)

    # Compute delta vs previous score
    prev_result = await db.execute(
        select(RiskScore)
        .where(
            RiskScore.entity_id == entity_id,
            RiskScore.theme == theme,
            RiskScore.is_current == True,  # noqa: E712
        )
        .limit(1)
    )
    prev_score = prev_result.scalar_one_or_none()

    delta_7d = None
    if prev_score:
        delta_7d = round(score - prev_score.score, 2)
        # Mark previous as not current
        await db.execute(
            update(RiskScore)
            .where(RiskScore.id == prev_score.id)
            .values(is_current=False)
        )

    new_score = RiskScore(
        entity_id=entity_id,
        theme=theme,
        score=score,
        confidence=confidence,
        score_delta_7d=delta_7d,
        weight_config_id=weight_config.id if weight_config else None,
        signal_breakdown=signal_breakdown,
        top_documents=top_doc_ids,
        is_current=True,
    )
    db.add(new_score)
    await db.flush()
    return new_score


async def get_default_weight_config(db: AsyncSession) -> Optional[WeightConfiguration]:
    result = await db.execute(
        select(WeightConfiguration).where(WeightConfiguration.is_default == True).limit(1)  # noqa: E712
    )
    return result.scalar_one_or_none()
