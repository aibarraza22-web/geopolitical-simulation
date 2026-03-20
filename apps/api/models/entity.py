import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import DateTime, ForeignKey, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from apps.api.database import Base


class Entity(Base):
    __tablename__ = "entities"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    type: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    # country | sector | company | person | region
    name: Mapped[str] = mapped_column(String(500), nullable=False, index=True)
    aliases: Mapped[list] = mapped_column(JSONB, default=list)
    iso_code: Mapped[Optional[str]] = mapped_column(String(10), nullable=True, index=True)
    parent_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("entities.id"), nullable=True
    )
    metadata_: Mapped[dict] = mapped_column("metadata", JSONB, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    # Relationships
    children: Mapped[list["Entity"]] = relationship("Entity", back_populates="parent")
    parent: Mapped[Optional["Entity"]] = relationship(
        "Entity", back_populates="children", remote_side="Entity.id"
    )
    risk_scores: Mapped[list["RiskScore"]] = relationship(  # noqa: F821
        "RiskScore", back_populates="entity"
    )
