from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel


class AlertRuleCreate(BaseModel):
    name: str
    entity_id: Optional[UUID] = None
    theme: Optional[str] = None
    condition: str  # score_above | score_below | delta_above | delta_below
    threshold: float
    delivery_channels: list[str] = ["in_app"]  # email | webhook | in_app
    webhook_url: Optional[str] = None


class AlertRuleOut(BaseModel):
    id: UUID
    name: str
    entity_id: Optional[UUID]
    theme: Optional[str]
    condition: str
    threshold: float
    delivery_channels: list
    webhook_url: Optional[str]
    is_active: bool
    last_triggered_at: Optional[datetime]
    created_at: datetime

    model_config = {"from_attributes": True}


class AlertEventOut(BaseModel):
    id: UUID
    rule_id: UUID
    entity_id: UUID
    theme: str
    triggered_score: float
    threshold: float
    triggered_at: datetime

    model_config = {"from_attributes": True}
