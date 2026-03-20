from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from apps.api.database import get_db
from apps.api.models import DataSource, IntelligenceDocument
from apps.api.schemas.intelligence import DataSourceOut, DocumentSearchResult, IntelligenceDocumentOut

router = APIRouter(prefix="/v1/intelligence", tags=["intelligence"])


@router.get("/documents", response_model=DocumentSearchResult)
async def list_documents(
    entity_id: Optional[UUID] = Query(None),
    source_type: Optional[str] = Query(None),
    q: Optional[str] = Query(None, description="Full-text search query"),
    page: int = Query(1, ge=1),
    limit: int = Query(25, le=100),
    db: AsyncSession = Depends(get_db),
):
    query = select(IntelligenceDocument)
    if entity_id:
        query = query.where(IntelligenceDocument.entities_mentioned.contains([str(entity_id)]))
    if source_type:
        query = query.where(IntelligenceDocument.source_type == source_type)

    count_query = query
    query = query.order_by(IntelligenceDocument.ingested_at.desc())
    query = query.offset((page - 1) * limit).limit(limit)

    result = await db.execute(query)
    documents = result.scalars().all()

    count_result = await db.execute(count_query)
    total = len(count_result.scalars().all())

    return DocumentSearchResult(
        items=documents,
        total=total,
        page=page,
        limit=limit,
    )


@router.get("/documents/{doc_id}", response_model=IntelligenceDocumentOut)
async def get_document(doc_id: UUID, db: AsyncSession = Depends(get_db)):
    from fastapi import HTTPException

    result = await db.execute(
        select(IntelligenceDocument).where(IntelligenceDocument.id == doc_id)
    )
    doc = result.scalar_one_or_none()
    if not doc:
        raise HTTPException(404, "Document not found")
    return doc


@router.get("/sources", response_model=list[DataSourceOut])
async def list_sources(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(DataSource).where(DataSource.is_active == True))  # noqa: E712
    return result.scalars().all()


@router.post("/sources/{source_id}/trigger")
async def trigger_source_fetch(source_id: UUID, db: AsyncSession = Depends(get_db)):
    from fastapi import HTTPException

    result = await db.execute(select(DataSource).where(DataSource.id == source_id))
    source = result.scalar_one_or_none()
    if not source:
        raise HTTPException(404, "Source not found")

    from apps.workers.tasks.ingest_news import fetch_source_task  # lazy import

    task = fetch_source_task.delay(str(source_id))
    return {"task_id": task.id, "source_name": source.name}
