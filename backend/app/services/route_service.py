from __future__ import annotations

from math import atan2, radians, sin, cos, sqrt
from typing import Any, Dict, List, Tuple

from app.services.risk_grid_service import build_risk_grid
from app.services.route_engine import build_route_pair


def _nearest_grid_point(lat: float, lon: float, lats: List[float], lons: List[float]) -> Tuple[int, int]:
    if not lats or not lons:
        raise ValueError("Risk grid has no coordinates")
    return min(range(len(lats)), key=lambda i: abs(lats[i] - lat)), min(range(len(lons)), key=lambda i: abs(lons[i] - lon))


def _haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    radius = 6371.0
    p1, p2 = radians(lat1), radians(lat2)
    dphi, dlambda = radians(lat2 - lat1), radians(lon2 - lon1)
    a = sin(dphi / 2) ** 2 + cos(p1) * cos(p2) * sin(dlambda / 2) ** 2
    return 2 * radius * atan2(sqrt(a), sqrt(max(0.0, 1.0 - a)))


def _path_coordinates(path, lats, lons):
    return [{"lat": round(float(lats[r]), 6), "lon": round(float(lons[c]), 6)} for r, c in path]


def _route_physical_metrics(path, lats, lons, speed_knots):
    distance = 0.0
    for (r1, c1), (r2, c2) in zip(path, path[1:]):
        distance += _haversine_km(lats[r1], lons[c1], lats[r2], lons[c2])
    speed_kmh = float(speed_knots) * 1.852
    return {"distance_km": round(distance, 3), "eta_hours": round(distance / speed_kmh, 3) if speed_kmh else 0.0}


def _explanation(pair, vessel_speed):
    f, s = pair["fastest_route"], pair["safest_route"]
    if not f["path"] or not s["path"]:
        return ["A complete route could not be found across the current risk grid."]
    messages = []
    if s["metrics"].get("average_risk", 0) < f["metrics"].get("average_risk", 0):
        messages.append("The safest route reduces average multi-hazard exposure compared with the fastest route.")
    else:
        messages.append("The fastest and safest routes have similar risk exposure under the current conditions.")
    if s["metrics"].get("distance_km", 0) > f["metrics"].get("distance_km", 0):
        messages.append("The safest route accepts additional travel distance to avoid higher-risk cells.")
    else:
        messages.append("The safest route does not require additional physical distance in this scenario.")
    messages.append(f"Vessel speed used for ETA calculation: {vessel_speed:g} knots.")
    messages.append("This is prototype A* decision support, not certified operational navigation advice.")
    return messages


def calculate_routes(start_lat, start_lon, destination_lat, destination_lon, speed_knots, ice_class,
                     rows=40, cols=40, max_points=5000, ice_multiplier=1.0, iceberg_multiplier=1.0):
    if speed_knots <= 0:
        raise ValueError("Vessel speed must be greater than zero")
    risk = build_risk_grid(rows=rows, cols=cols, max_environment_points=max_points,
                           extra_points=[{"latitude": start_lat, "longitude": start_lon},
                                         {"latitude": destination_lat, "longitude": destination_lon}],
                           ice_multiplier=ice_multiplier, iceberg_multiplier=iceberg_multiplier)
    start = _nearest_grid_point(start_lat, start_lon, risk["latitudes"], risk["longitudes"])
    goal = _nearest_grid_point(destination_lat, destination_lon, risk["latitudes"], risk["longitudes"])
    pair = build_route_pair(risk["grid"], start, goal)
    for key in ("fastest_route", "safest_route"):
        route = pair[key]
        route["coordinates"] = _path_coordinates(route["path"], risk["latitudes"], risk["longitudes"])
        route["metrics"].update(_route_physical_metrics(route["path"], risk["latitudes"], risk["longitudes"], speed_knots))
        route["metrics"]["speed_knots"] = float(speed_knots)
    f, s = pair["fastest_route"]["metrics"], pair["safest_route"]["metrics"]
    return {
        "fastest_route": pair["fastest_route"], "safest_route": pair["safest_route"],
        "risk": {"start_cell": {"row": start[0], "col": start[1]}, "destination_cell": {"row": goal[0], "col": goal[1]},
                 "fastest_average_risk": f["average_risk"], "safest_average_risk": s["average_risk"],
                 "fastest_max_risk": f["max_risk"], "safest_max_risk": s["max_risk"],
                 "risk_grid_level_counts": risk["level_counts"]},
        "explanation": _explanation(pair, speed_knots),
        "request": {"start": {"lat": start_lat, "lon": start_lon}, "destination": {"lat": destination_lat, "lon": destination_lon},
                     "vessel": {"ice_class": ice_class, "speed_knots": speed_knots}},
        "grid": {"rows": risk["rows"], "cols": risk["cols"], "bounds": risk["bounds"]},
        "method": "A* fastest-vs-safest routing over prototype multi-hazard risk grid",
    }
