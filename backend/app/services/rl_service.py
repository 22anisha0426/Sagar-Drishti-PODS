from __future__ import annotations

from typing import Any, Dict, List, Tuple

from app.services.risk_grid_service import build_risk_grid
from app.services.rl_engine import replan_on_grid
from app.services.route_engine import astar


def _nearest(lat: float, lon: float, lats: List[float], lons: List[float]) -> Tuple[int, int]:
    if not lats or not lons:
        raise ValueError("Risk grid has no coordinates")
    return (
        min(range(len(lats)), key=lambda i: abs(lats[i] - lat)),
        min(range(len(lons)), key=lambda i: abs(lons[i] - lon)),
    )


def _coords(path: List[Tuple[int, int]], lats: List[float], lons: List[float]) -> List[Dict[str, float]]:
    return [{"lat": round(float(lats[r]), 6), "lon": round(float(lons[c]), 6)} for r, c in path]


def replan_route_with_rl(request: Any, rows: int, cols: int, max_points: int) -> Dict[str, Any]:
    try:
        current_lat = float(request.vessel_position["lat"])
        current_lon = float(request.vessel_position["lon"])
        destination_lat = float(request.destination["lat"])
        destination_lon = float(request.destination["lon"])
    except (KeyError, TypeError, ValueError) as exc:
        raise ValueError("vessel_position and destination must contain numeric lat/lon values") from exc

    risk = build_risk_grid(
        rows=rows,
        cols=cols,
        max_environment_points=max_points,
        extra_points=[
            {"latitude": current_lat, "longitude": current_lon},
            {"latitude": destination_lat, "longitude": destination_lon},
        ],
    )
    current = _nearest(current_lat, current_lon, risk["latitudes"], risk["longitudes"])
    goal = _nearest(destination_lat, destination_lon, risk["latitudes"], risk["longitudes"])

    rl = replan_on_grid(risk["grid"], current, goal, episodes=250)

    next_cell = tuple(rl["next_cell"]) if rl.get("next_cell") else None
    if rl["action"] == "HALT" or next_cell is None:
        new_path: List[Tuple[int, int]] = []
    else:
        tail = astar(risk["grid"], next_cell, goal, risk_weight=3.0)
        new_path = [current] + tail if tail else [current, next_cell]

    route = {
        "path": [list(p) for p in new_path],
        "coordinates": _coords(new_path, risk["latitudes"], risk["longitudes"]),
        "destination": {"lat": destination_lat, "lon": destination_lon},
    }

    return {
        "new_route": route,
        "action": rl["action"],
        "reason": rl["reason"],
        "risk": rl["risk"],
        "policy": rl["policy"],
        "training": rl["training"],
        "current_cell": list(current),
        "destination_cell": list(goal),
        "halted": rl["action"] == "HALT",
        "risk_definition": risk["risk_definition"],
    }
