from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from apps.api.database import get_db
from apps.api.models import Entity

router = APIRouter(prefix="/v1/entities", tags=["entities"])


@router.get("")
async def list_entities(
    type: Optional[str] = Query(None),
    q: Optional[str] = Query(None),
    limit: int = Query(100, le=500),
    db: AsyncSession = Depends(get_db),
):
    query = select(Entity)
    if type:
        query = query.where(Entity.type == type)
    if q:
        query = query.where(Entity.name.ilike(f"%{q}%"))
    query = query.order_by(Entity.name).limit(limit)
    result = await db.execute(query)
    entities = result.scalars().all()
    return [
        {
            "id": str(e.id),
            "type": e.type,
            "name": e.name,
            "iso_code": e.iso_code,
            "aliases": e.aliases,
        }
        for e in entities
    ]
