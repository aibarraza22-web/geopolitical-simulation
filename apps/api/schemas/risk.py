from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field


class WeightConfigCreate(BaseModel):
    name: str
    weights: dict = Field(
        ...,
        example={
            "conflict": {"military_activity": 0.4, "political_instability": 0.35, "border_tension": 0.25},
            "sanctions": {"ofac_listings": 0.5, "un_resolutions": 0.3, "news_sentiment": 0.2},
            "political": {"election_risk": 0.4, "regime_stability": 0.4, "protest_activity": 0.2},
            "economic": {"gdp_growth": 0.3, "inflation": 0.3, "debt_level": 0.2, "trade_balance": 0.2},
        },
    )


class WeightConfigOut(BaseModel):
    id: UUID
    name: str
    is_default: bool
    weights: dict
    version: int
    created_at: datetime

    model_config = {"from_attributes": True}


class RiskScoreOut(BaseModel):
    id: UUID
    entity_id: UUID
    theme: str
    score: float
    confidence: float
    score_delta_7d: Optional[float]
    computed_at: datetime
    signal_breakdown: dict
    top_documents: list
    is_current: bool

    model_config = {"from_attributes": True}


class RiskScoreHistoryPoint(BaseModel):
    timestamp: datetime
    score: float
    confidence: float


class HeatmapItem(BaseModel):
    entity_id: UUID
    entity_name: str
    entity_type: str
    iso_code: Optional[str]
    theme: str
    score: float
    confidence: float
    delta_7d: Optional[float]


class RecomputeRequest(BaseModel):
    entity_ids: Optional[list[UUID]] = None
    themes: Optional[list[str]] = None
    weight_config_id: Optional[UUID] = None
