"""
Scenario Simulation Engine.

Implements parameterized scenario templates: sanctions, conflict_escalation,
trade_disruption, regulatory_shift, supply_chain_shock.
Each template applies a primary shock and propagates second-order effects
through the entity graph using bilateral trade weights.
"""

from __future__ import annotations

import random
import uuid
from datetime import datetime, timezone
from typing import Any

import numpy as np
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from apps.api.models import Entity, RiskScore, Scenario
from apps.api.services.scoring import ALL_THEMES


# ── Simplified trade exposure graph (seeded from World Bank data in production) ──────────────
# In MVP we use a flat 10% exposure for all country pairs; the seed script populates real values.
_FALLBACK_EXPOSURE = 0.10


async def _get_trade_neighbors(
    db: AsyncSession, entity_id: uuid.UUID, hops: int = 2
) -> dict[str, float]:
    """
    Return {entity_id_str: exposure_weight} for entities connected via trade.
    Falls back to a flat exposure when the edge table is empty.
    """
    result = await db.execute(
        select(Entity).where(Entity.type == "country").limit(30)
    )
    countries = result.scalars().all()
    neighbors: dict[str, float] = {}
    for c in countries:
        if str(c.id) != str(entity_id):
            neighbors[str(c.id)] = _FALLBACK_EXPOSURE
    return neighbors


def _monte_carlo(base_delta: float, iterations: int = 200) -> dict[str, float]:
    """Return P10 / P50 / P90 confidence interval over the score delta."""
    noise = np.random.normal(0, base_delta * 0.25, iterations)
    samples = np.clip(base_delta + noise, -100, 100)
    return {
        "p10": float(round(np.percentile(samples, 10), 2)),
        "p50": float(round(np.percentile(samples, 50), 2)),
        "p90": float(round(np.percentile(samples, 90), 2)),
    }


async def _current_scores(
    db: AsyncSession, entity_ids: list[uuid.UUID]
) -> dict[str, dict[str, float]]:
    """Return {entity_id: {theme: score}} for the given entity IDs."""
    result = await db.execute(
        select(RiskScore).where(
            RiskScore.entity_id.in_(entity_ids),
            RiskScore.is_current == True,  # noqa: E712
        )
    )
    scores: dict[str, dict[str, float]] = {}
    for rs in result.scalars().all():
        eid = str(rs.entity_id)
        scores.setdefault(eid, {})[rs.theme] = rs.score
    return scores


# ── Template runners ─────────────────────────────────────────────────────────────────────────

async def _run_sanctions(db: AsyncSession, params: dict) -> dict:
    target_ids = [uuid.UUID(x) for x in params.get("target_entity_ids", [])]
    severity: float = params.get("severity", 0.5)
    duration_months: int = params.get("duration_months", 12)

    base_scores = await _current_scores(db, target_ids)
    impacted: list[dict] = []
    score_deltas: dict[str, float] = {}

    for eid in target_ids:
        eid_str = str(eid)
        primary_delta = min(100, severity * 45)
        score_deltas[f"{eid_str}_sanctions"] = round(primary_delta, 2)
        score_deltas[f"{eid_str}_economic"] = round(primary_delta * 0.6, 2)
        impacted.append({"entity_id": eid_str, "type": "primary", "delta": primary_delta})

        # Second-order: trade partners
        neighbors = await _get_trade_neighbors(db, eid, hops=1)
        for nid, exposure in neighbors.items():
            secondary_delta = primary_delta * exposure * 0.4
            score_deltas[f"{nid}_trade"] = round(
                score_deltas.get(f"{nid}_trade", 0) + secondary_delta, 2
            )
            impacted.append({"entity_id": nid, "type": "secondary", "delta": round(secondary_delta, 2)})

    ci = _monte_carlo(severity * 45)
    return {
        "probability": round(min(0.95, 0.4 + severity * 0.5), 2),
        "impacted_entities": impacted[:50],
        "score_deltas": score_deltas,
        "economic_impact": {
            "gdp_delta_pct": round(-severity * duration_months * 0.15, 2),
            "trade_volume_delta_pct": round(-severity * 20, 2),
        },
        "confidence_interval": ci,
        "duration_months": duration_months,
    }


async def _run_conflict_escalation(db: AsyncSession, params: dict) -> dict:
    region_ids = [uuid.UUID(x) for x in params.get("region_entity_ids", [])]
    escalation: float = params.get("escalation_level", 0.5)
    spillover_radius: int = params.get("spillover_radius", 2)

    score_deltas: dict[str, float] = {}
    impacted: list[dict] = []

    for eid in region_ids:
        eid_str = str(eid)
        primary_delta = min(100, escalation * 55)
        score_deltas[f"{eid_str}_conflict"] = round(primary_delta, 2)
        score_deltas[f"{eid_str}_political"] = round(primary_delta * 0.7, 2)
        impacted.append({"entity_id": eid_str, "type": "primary", "delta": primary_delta})

        neighbors = await _get_trade_neighbors(db, eid, hops=spillover_radius)
        for nid, exposure in list(neighbors.items())[:10]:
            spill_delta = primary_delta * exposure * 0.35
            score_deltas[f"{nid}_conflict"] = round(spill_delta, 2)
            impacted.append({"entity_id": nid, "type": "spillover", "delta": round(spill_delta, 2)})

    ci = _monte_carlo(escalation * 55)
    return {
        "probability": round(min(0.90, 0.3 + escalation * 0.55), 2),
        "impacted_entities": impacted[:50],
        "score_deltas": score_deltas,
        "economic_impact": {
            "gdp_delta_pct": round(-escalation * 3.5, 2),
            "refugee_displacement_estimate": int(escalation * 500_000),
        },
        "confidence_interval": ci,
    }


async def _run_trade_disruption(db: AsyncSession, params: dict) -> dict:
    corridor_ids = [uuid.UUID(x) for x in params.get("corridor_entity_ids", [])]
    disruption: float = params.get("disruption_fraction", 0.5)
    commodities: list[str] = params.get("affected_commodities", [])

    score_deltas: dict[str, float] = {}
    impacted: list[dict] = []

    for eid in corridor_ids:
        eid_str = str(eid)
        primary_delta = min(100, disruption * 35)
        score_deltas[f"{eid_str}_trade"] = round(primary_delta, 2)
        score_deltas[f"{eid_str}_supply_chain"] = round(primary_delta * 0.8, 2)
        impacted.append({"entity_id": eid_str, "type": "primary", "delta": primary_delta})

        neighbors = await _get_trade_neighbors(db, eid, hops=1)
        for nid, exposure in list(neighbors.items())[:15]:
            supply_delta = primary_delta * exposure * 0.5
            score_deltas[f"{nid}_supply_chain"] = round(supply_delta, 2)
            impacted.append({"entity_id": nid, "type": "downstream", "delta": round(supply_delta, 2)})

    ci = _monte_carlo(disruption * 35)
    return {
        "probability": round(min(0.85, 0.45 + disruption * 0.4), 2),
        "impacted_entities": impacted[:50],
        "score_deltas": score_deltas,
        "affected_commodities": commodities,
        "economic_impact": {
            "trade_volume_delta_pct": round(-disruption * 15, 2),
            "price_shock_pct": round(disruption * 12, 2),
        },
        "confidence_interval": ci,
    }


async def _run_regulatory_shift(db: AsyncSession, params: dict) -> dict:
    sector_ids = [uuid.UUID(x) for x in params.get("sector_entity_ids", [])]
    regulation_type: str = params.get("regulation_type", "tariff")
    impact: float = params.get("impact_score", 0.5)

    THEME_MAP = {
        "tariff": "trade",
        "export_control": "regulatory",
        "environmental": "regulatory",
        "data_privacy": "regulatory",
    }
    affected_theme = THEME_MAP.get(regulation_type, "regulatory")

    score_deltas: dict[str, float] = {}
    impacted: list[dict] = []
    for eid in sector_ids:
        eid_str = str(eid)
        delta = min(100, impact * 30)
        score_deltas[f"{eid_str}_{affected_theme}"] = round(delta, 2)
        impacted.append({"entity_id": eid_str, "type": "primary", "delta": delta})

    ci = _monte_carlo(impact * 30)
    return {
        "probability": round(min(0.88, 0.5 + impact * 0.38), 2),
        "regulation_type": regulation_type,
        "impacted_entities": impacted,
        "score_deltas": score_deltas,
        "economic_impact": {"sector_revenue_delta_pct": round(-impact * 8, 2)},
        "confidence_interval": ci,
    }


async def _run_supply_chain_shock(db: AsyncSession, params: dict) -> dict:
    source_ids = [uuid.UUID(x) for x in params.get("source_entity_ids", [])]
    magnitude: float = params.get("shock_magnitude", 0.5)
    steps: int = params.get("propagation_steps", 3)

    score_deltas: dict[str, float] = {}
    impacted: list[dict] = []
    for eid in source_ids:
        eid_str = str(eid)
        primary_delta = min(100, magnitude * 40)
        score_deltas[f"{eid_str}_supply_chain"] = round(primary_delta, 2)
        impacted.append({"entity_id": eid_str, "type": "primary", "delta": primary_delta})

        neighbors = await _get_trade_neighbors(db, eid, hops=steps)
        attenuation = 1.0
        for nid, exposure in list(neighbors.items())[:20]:
            attenuation *= 0.6
            downstream_delta = primary_delta * exposure * attenuation
            score_deltas[f"{nid}_supply_chain"] = round(downstream_delta, 2)
            impacted.append({"entity_id": nid, "type": "downstream", "delta": round(downstream_delta, 2)})

    ci = _monte_carlo(magnitude * 40)
    return {
        "probability": round(min(0.80, 0.35 + magnitude * 0.45), 2),
        "propagation_steps": steps,
        "impacted_entities": impacted[:50],
        "score_deltas": score_deltas,
        "economic_impact": {
            "production_loss_pct": round(magnitude * 6, 2),
            "price_shock_pct": round(magnitude * 9, 2),
        },
        "confidence_interval": ci,
    }


_RUNNERS = {
    "sanctions": _run_sanctions,
    "conflict_escalation": _run_conflict_escalation,
    "trade_disruption": _run_trade_disruption,
    "regulatory_shift": _run_regulatory_shift,
    "supply_chain_shock": _run_supply_chain_shock,
}


async def run_scenario(db: AsyncSession, scenario_id: uuid.UUID) -> Scenario:
    result = await db.execute(select(Scenario).where(Scenario.id == scenario_id))
    scenario = result.scalar_one_or_none()
    if not scenario:
        raise ValueError(f"Scenario {scenario_id} not found")

    runner = _RUNNERS.get(scenario.template_type)
    if not runner:
        raise ValueError(f"Unknown template type: {scenario.template_type}")

    scenario.status = "running"
    await db.flush()

    try:
        results = await runner(db, scenario.parameters)
        scenario.results = results
        scenario.status = "completed"
        scenario.completed_at = datetime.now(timezone.utc)
    except Exception as exc:
        scenario.status = "failed"
        scenario.results = {"error": str(exc)}

    await db.flush()
    return scenario
