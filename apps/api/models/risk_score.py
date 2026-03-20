import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Index, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from apps.api.database import Base


class WeightConfiguration(Base):
    __tablename__ = "weight_configurations"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    created_by: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), nullable=True)
    is_default: Mapped[bool] = mapped_column(Boolean, default=False)
    weights: Mapped[dict] = mapped_column(JSONB, nullable=False)
    version: Mapped[int] = mapped_column(Integer, default=1)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    risk_scores: Mapped[list["RiskScore"]] = relationship(
        "RiskScore", back_populates="weight_config"
    )


class RiskScore(Base):
    __tablename__ = "risk_scores"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    entity_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("entities.id"), nullable=False, index=True
    )
    theme: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    # conflict | sanctions | political | economic | regulatory | supply_chain | trade
    score: Mapped[float] = mapped_column(Float, nullable=False)  # 0.0 to 100.0
    confidence: Mapped[float] = mapped_column(Float, default=0.5)  # 0.0 to 1.0
    score_delta_7d: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    computed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), index=True
    )
    weight_config_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("weight_configurations.id"), nullable=True
    )
    signal_breakdown: Mapped[dict] = mapped_column(JSONB, default=dict)
    top_documents: Mapped[list] = mapped_column(JSONB, default=list)
    is_current: Mapped[bool] = mapped_column(Boolean, default=True, index=True)

    entity: Mapped["Entity"] = relationship("Entity", back_populates="risk_scores")  # noqa: F821
    weight_config: Mapped[Optional["WeightConfiguration"]] = relationship(
        "WeightConfiguration", back_populates="risk_scores"
    )

    __table_args__ = (
        Index("ix_risk_scores_current_entity_theme", "entity_id", "theme", "is_current"),
    )
