from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from apps.api.database import get_db
from apps.api.models import Scenario
from apps.api.schemas.scenario import (
    SCENARIO_TEMPLATES,
    ScenarioCreate,
    ScenarioOut,
    ScenarioTemplateOut,
)

router = APIRouter(prefix="/v1/scenarios", tags=["scenarios"])


@router.get("/templates", response_model=list[ScenarioTemplateOut])
async def list_templates():
    return [
        ScenarioTemplateOut(
            type=t,
            name=meta["name"],
            description=meta["description"],
            parameter_schema=meta["parameter_schema"],
        )
        for t, meta in SCENARIO_TEMPLATES.items()
    ]


@router.get("", response_model=list[ScenarioOut])
async def list_scenarios(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Scenario).order_by(Scenario.created_at.desc()).limit(100))
    return result.scalars().all()


@router.post("", response_model=ScenarioOut, status_code=201)
async def create_scenario(payload: ScenarioCreate, db: AsyncSession = Depends(get_db)):
    if payload.template_type not in SCENARIO_TEMPLATES:
        raise HTTPException(400, f"Unknown template type: {payload.template_type}")
    scenario = Scenario(
        name=payload.name,
        template_type=payload.template_type,
        parameters=payload.parameters,
        status="draft",
    )
    db.add(scenario)
    await db.flush()
    return scenario


@router.get("/{scenario_id}", response_model=ScenarioOut)
async def get_scenario(scenario_id: UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Scenario).where(Scenario.id == scenario_id))
    scenario = result.scalar_one_or_none()
    if not scenario:
        raise HTTPException(404, "Scenario not found")
    return scenario


@router.post("/{scenario_id}/run")
async def run_scenario(scenario_id: UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Scenario).where(Scenario.id == scenario_id))
    scenario = result.scalar_one_or_none()
    if not scenario:
        raise HTTPException(404, "Scenario not found")
    if scenario.status == "running":
        raise HTTPException(409, "Scenario is already running")

    from apps.workers.tasks.scenario_runner import run_scenario_task  # lazy import

    task = run_scenario_task.delay(str(scenario_id))
    return {"task_id": task.id, "scenario_id": str(scenario_id)}
