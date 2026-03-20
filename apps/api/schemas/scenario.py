from datetime import datetime
from typing import Any, Optional
from uuid import UUID

from pydantic import BaseModel, Field


SCENARIO_TEMPLATES = {
    "sanctions": {
        "name": "Sanctions Scenario",
        "description": "Model the impact of sanctions on target entities and their trade network.",
        "parameter_schema": {
            "type": "object",
            "required": ["target_entity_ids", "sanction_scope", "severity"],
            "properties": {
                "target_entity_ids": {"type": "array", "items": {"type": "string"}, "description": "Entity IDs to sanction"},
                "sanction_scope": {"type": "array", "items": {"type": "string"}, "description": "Sectors affected (energy, finance, tech, etc.)"},
                "severity": {"type": "number", "minimum": 0, "maximum": 1, "description": "Sanction intensity 0-1"},
                "duration_months": {"type": "integer", "default": 12},
            },
        },
    },
    "conflict_escalation": {
        "name": "Conflict Escalation",
        "description": "Simulate escalation of a regional conflict and downstream effects.",
        "parameter_schema": {
            "type": "object",
            "required": ["region_entity_ids", "escalation_level"],
            "properties": {
                "region_entity_ids": {"type": "array", "items": {"type": "string"}},
                "escalation_level": {"type": "number", "minimum": 0, "maximum": 1},
                "spillover_radius": {"type": "integer", "default": 2, "description": "Graph hops for spillover"},
            },
        },
    },
    "trade_disruption": {
        "name": "Trade Disruption",
        "description": "Model supply chain shocks from a trade route or corridor disruption.",
        "parameter_schema": {
            "type": "object",
            "required": ["corridor_entity_ids", "disruption_fraction"],
            "properties": {
                "corridor_entity_ids": {"type": "array", "items": {"type": "string"}},
                "disruption_fraction": {"type": "number", "minimum": 0, "maximum": 1},
                "affected_commodities": {"type": "array", "items": {"type": "string"}, "default": []},
            },
        },
    },
    "regulatory_shift": {
        "name": "Regulatory Shift",
        "description": "Model the impact of a major regulatory change on targeted sectors.",
        "parameter_schema": {
            "type": "object",
            "required": ["sector_entity_ids", "regulation_type", "impact_score"],
            "properties": {
                "sector_entity_ids": {"type": "array", "items": {"type": "string"}},
                "regulation_type": {"type": "string", "enum": ["tariff", "export_control", "environmental", "data_privacy"]},
                "impact_score": {"type": "number", "minimum": 0, "maximum": 1},
            },
        },
    },
    "supply_chain_shock": {
        "name": "Supply Chain Shock",
        "description": "Simulate a critical input shortage or logistics disruption.",
        "parameter_schema": {
            "type": "object",
            "required": ["source_entity_ids", "shock_magnitude"],
            "properties": {
                "source_entity_ids": {"type": "array", "items": {"type": "string"}},
                "shock_magnitude": {"type": "number", "minimum": 0, "maximum": 1},
                "propagation_steps": {"type": "integer", "default": 3},
            },
        },
    },
}


class ScenarioCreate(BaseModel):
    name: str
    template_type: str
    parameters: dict[str, Any]


class ScenarioOut(BaseModel):
    id: UUID
    name: str
    template_type: str
    status: str
    parameters: dict
    results: Optional[dict]
    created_at: datetime
    completed_at: Optional[datetime]

    model_config = {"from_attributes": True}


class ScenarioTemplateOut(BaseModel):
    type: str
    name: str
    description: str
    parameter_schema: dict
