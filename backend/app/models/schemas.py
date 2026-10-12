from typing import Any, Dict, List
from pydantic import BaseModel, Field


class GeoPoint(BaseModel):
    lat: float = Field(..., ge=-90, le=90)
    lon: float = Field(..., ge=-180, le=180)


class Vessel(BaseModel):
    ice_class: str
    speed_knots: float = Field(..., gt=0)


class RouteRequest(BaseModel):
    start: GeoPoint
    destination: GeoPoint
    vessel: Vessel


class RouteResponse(BaseModel):
    fastest_route: Dict[str, Any]
    safest_route: Dict[str, Any]
    risk: Dict[str, Any]
    explanation: List[str]


class ReplanRequest(BaseModel):
    vessel_position: Dict[str, Any]
    destination: Dict[str, Any]
    environment: Dict[str, Any]
    mode: str = "RL"


class ReplanResponse(BaseModel):
    new_route: Dict[str, Any]
    action: str
    reason: str
