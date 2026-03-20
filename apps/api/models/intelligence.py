import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from apps.api.database import Base


class DataSource(Base):
    __tablename__ = "data_sources"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(255), nullable=False, unique=True)
    source_type: Mapped[str] = mapped_column(String(50), nullable=False)
    # rss | api | html_scrape | file_feed
    endpoint_url: Mapped[str] = mapped_column(Text, nullable=False)
    fetch_interval_seconds: Mapped[int] = mapped_column(Integer, default=3600)
    reliability_score: Mapped[float] = mapped_column(Float, default=0.7)
    last_fetched_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    config: Mapped[dict] = mapped_column(JSONB, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    documents: Mapped[list["IntelligenceDocument"]] = relationship(
        "IntelligenceDocument", back_populates="source"
    )


class IntelligenceDocument(Base):
    __tablename__ = "intelligence_documents"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    source_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("data_sources.id"), nullable=False, index=True
    )
    raw_url: Mapped[str] = mapped_column(Text, nullable=False)
    title: Mapped[str] = mapped_column(Text, nullable=False)
    body_text: Mapped[str] = mapped_column(Text, default="")
    published_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True, index=True
    )
    ingested_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    language: Mapped[str] = mapped_column(String(10), default="en")
    source_type: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    content_hash: Mapped[str] = mapped_column(String(64), nullable=False, unique=True)
    entities_mentioned: Mapped[list] = mapped_column(JSONB, default=list)  # list of entity UUIDs
    sentiment_score: Mapped[Optional[float]] = mapped_column(Float, nullable=True)  # -1.0 to 1.0
    relevance_score: Mapped[Optional[float]] = mapped_column(Float, nullable=True)  # 0.0 to 1.0
    metadata_: Mapped[dict] = mapped_column("metadata", JSONB, default=dict)

    source: Mapped["DataSource"] = relationship("DataSource", back_populates="documents")
