from datetime import datetime, timezone
from typing import Any, Dict

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field

from app.services.db_service import save_result
from app.services.route_service import calculate_routes
from app.services.risk_grid_service import build_risk_grid
from app.services.rl_service import replan_route_with_rl

router = APIRouter(prefix="/api", tags=["Simulation"])


class SimulationRequest(BaseModel):
    scenario: str = Field(..., pattern=r"^[ABC]$")
    ice_multiplier: float = Field(1.0, ge=0.0)
    iceberg_multiplier: float = Field(1.0, ge=0.0)
    start: Dict[str, float] | None = None
    destination: Dict[str, float] | None = None
    vessel: Dict[str, Any] | None = None


def _defaults(request: SimulationRequest):
    start = request.start or {"lat": -60.0, "lon": 60.0}
    destination = request.destination or {"lat": -64.0, "lon": 70.0}
    vessel = request.vessel or {"ice_class": "PC6", "speed_knots": 12.0}
    return start, destination, vessel


@router.post("/simulation")
def run_simulation(
    request: SimulationRequest,
    rows: int = Query(40, ge=5, le=100),
    cols: int = Query(40, ge=5, le=100),
    max_points: int = Query(5000, ge=100, le=50000),
):
    scenarios = {
        "A": {"name": "Clear water", "expected_behavior": "Fast route approximately equals safe route"},
        "B": {"name": "High ice", "expected_behavior": "Fast route has higher risk; safe route diverts"},
        "C": {"name": "Iceberg cluster", "expected_behavior": "Hazard detected and route is replanned"},
    }
    selected = scenarios[request.scenario]
    start, destination, vessel = _defaults(request)

    try:
        ice_multiplier = request.ice_multiplier
        iceberg_multiplier = request.iceberg_multiplier
        if request.scenario == "B" and request.ice_multiplier == 1.0:
            ice_multiplier = 2.0
        if request.scenario == "C" and request.iceberg_multiplier == 1.0:
            iceberg_multiplier = 3.0

        route_result = calculate_routes(
            start_lat=float(start["lat"]), start_lon=float(start["lon"]),
            destination_lat=float(destination["lat"]), destination_lon=float(destination["lon"]),
            speed_knots=float(vessel.get("speed_knots", 12.0)),
            ice_class=str(vessel.get("ice_class", "PC6")),
            rows=rows, cols=cols, max_points=max_points,
            ice_multiplier=ice_multiplier,
            iceberg_multiplier=iceberg_multiplier,
        )

        rl_result = None
        if request.scenario == "C":
            rl_request = type("RLRequest", (), {
                "vessel_position": start,
                "destination": destination,
                "environment": {},
                "mode": "RL",
            })()
            rl_result = replan_route_with_rl(rl_request, rows, cols, max_points)

        result = {
            "simulation_id": f"SIM-{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S%f')}",
            "timestamp": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
            "scenario": request.scenario,
            "name": selected["name"],
            "expected_behavior": selected["expected_behavior"],
            "multipliers": {"ice": ice_multiplier, "iceberg": iceberg_multiplier},
            "routes": route_result,
            "rl_replanning": rl_result,
        }
        result["storage_id"] = save_result("simulation_runs", {
            "simulation_id": result["simulation_id"],
            "scenario": request.scenario,
            "result": result,
        })
        return result
    except (KeyError, TypeError, ValueError) as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Simulation failed: {exc}") from exc
