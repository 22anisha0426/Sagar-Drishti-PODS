from __future__ import annotations

from math import hypot
from typing import Any, Dict, Iterable, List

from app.services.environment_service import get_environment
from app.services.iceberg_service import get_iceberg_tracks, haversine_km
from app.services.risk_engine import combined_risk


def _clamp(v): return max(0.0, min(1.0, float(v)))
def _norm(value, minimum, maximum):
    try: x = float(value)
    except (TypeError, ValueError): return 0.0
    return _clamp((x - minimum) / (maximum - minimum)) if maximum > minimum else 0.0


def _nearest_value(points: Iterable[Dict[str, Any]], lat, lon, key):
    best_distance, best_value = float("inf"), 0.0
    for point in points:
        try:
            plat, plon, value = float(point["latitude"]), float(point["longitude"]), float(point[key])
        except (KeyError, TypeError, ValueError):
            continue
        distance = hypot((plon - lon) * 111.32, (plat - lat) * 111.32)
        if distance < best_distance:
            best_distance, best_value = distance, value
    return best_value


def _iceberg_cell_risk(lat, lon, icebergs, multiplier=1.0):
    maximum = 0.0
    for iceberg in icebergs:
        try:
            distance = haversine_km(lat, lon, float(iceberg["latitude"]), float(iceberg["longitude"]))
            radius = max(1.0, float(iceberg.get("risk_radius_km", 25.0)))
        except (KeyError, TypeError, ValueError):
            continue
        if distance <= radius:
            maximum = max(maximum, 1.0 - distance / radius)
    return _clamp(maximum * multiplier)


def _expand_bounds(bounds, icebergs, extra_points=None):
    valid = bounds.get("min_lat") is not None
    points = list(icebergs) + list(extra_points or [])
    if not points and not valid:
        raise ValueError("No environmental or iceberg coordinates are available to build the risk grid")
    if points:
        lats = [float(x["latitude"]) for x in points]; lons = [float(x["longitude"]) for x in points]
        if valid:
            return {"min_lat": min(float(bounds["min_lat"]), min(lats)), "max_lat": max(float(bounds["max_lat"]), max(lats)),
                    "min_lon": min(float(bounds["min_lon"]), min(lons)), "max_lon": max(float(bounds["max_lon"]), max(lons))}
        return {"min_lat": min(lats), "max_lat": max(lats), "min_lon": min(lons), "max_lon": max(lons)}
    return {k: float(bounds[k]) for k in ("min_lat", "max_lat", "min_lon", "max_lon")}


def _axis(a, b, n):
    if n <= 1 or a == b: return [(a + b) / 2.0]
    step = (b - a) / (n - 1)
    return [a + i * step for i in range(n)]


def build_risk_grid(rows=40, cols=40, max_environment_points=5000, extra_points=None,
                    ice_multiplier=1.0, iceberg_multiplier=1.0):
    if not (5 <= rows <= 150 and 5 <= cols <= 150):
        raise ValueError("rows and cols must be between 5 and 150")
    environment = get_environment(max_points=max_environment_points)
    icebergs = get_iceberg_tracks()
    bounds = _expand_bounds(environment["grid"], icebergs, extra_points)
    lats, lons = _axis(bounds["min_lat"], bounds["max_lat"], rows), _axis(bounds["min_lon"], bounds["max_lon"], cols)
    sea_ice, wind, waves, currents = environment.get("sea_ice", []), environment.get("wind", []), environment.get("waves", []), environment.get("currents", [])
    grid, components, counts = [], [], {"LOW": 0, "MEDIUM": 0, "HIGH": 0, "EXTREME": 0}
    for lat in lats:
        row, crow = [], []
        for lon in lons:
            sic = _nearest_value(sea_ice, lat, lon, "concentration")
            ws = _nearest_value(wind, lat, lon, "speed")
            wh = _nearest_value(waves, lat, lon, "height")
            cs = _nearest_value(currents, lat, lon, "speed")
            components_risk = {
                "sea_ice": _clamp((_norm(sic, 0, 1) if sic <= 1 else _norm(sic, 0, 100)) * ice_multiplier),
                "iceberg": _iceberg_cell_risk(lat, lon, icebergs, iceberg_multiplier),
                "wave": _norm(wh, 0, 8), "wind": _norm(ws, 0, 30), "current": _norm(cs, 0, 2),
            }
            risk = combined_risk(**components_risk)
            score, level = float(risk["score"]), risk["level"]
            counts[level] += 1; row.append(score)
            crow.append({"latitude": round(lat, 6), "longitude": round(lon, 6), "components": components_risk, "score": score, "level": level})
        grid.append(row); components.append(crow)
    return {"grid": grid, "components": components, "rows": rows, "cols": cols, "latitudes": lats, "longitudes": lons,
            "bounds": bounds, "level_counts": counts, "iceberg_count": len(icebergs),
            "environment_counts": environment.get("meta", {}).get("counts", {}),
            "multipliers": {"ice": ice_multiplier, "iceberg": iceberg_multiplier},
            "method": "multi-hazard weighted prototype risk grid",
            "risk_definition": "POLARIS-inspired prototype risk layer; not certified POLARIS RIO"}
