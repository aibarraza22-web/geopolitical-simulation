from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel


class DataSourceOut(BaseModel):
    id: UUID
    name: str
    source_type: str
    endpoint_url: str
    fetch_interval_seconds: int
    reliability_score: float
    last_fetched_at: Optional[datetime]
    is_active: bool

    model_config = {"from_attributes": True}


class IntelligenceDocumentOut(BaseModel):
    id: UUID
    source_id: UUID
    raw_url: str
    title: str
    body_text: str
    published_at: Optional[datetime]
    ingested_at: datetime
    language: str
    source_type: str
    entities_mentioned: list
    sentiment_score: Optional[float]
    relevance_score: Optional[float]

    model_config = {"from_attributes": True}


class DocumentSearchResult(BaseModel):
    items: list[IntelligenceDocumentOut]
    total: int
    page: int
    limit: int
