from typing import Any, Dict
from app.services.data_utils import downsample, latest_timestamp
from app.services.ice_service import get_latest_sea_ice
from app.services.ocean_service import load_ocean_data
from app.services.weather_service import get_latest_weather


def get_environment(max_points: int = 5000) -> Dict[str, Any]:
    sea_ice = downsample(get_latest_sea_ice(), max_points)
    currents = downsample(load_ocean_data(), max_points)
    weather = get_latest_weather()
    wind = downsample(weather.get("wind", []), max_points)
    waves = downsample(weather.get("waves", []), max_points)

    all_records = sea_ice + currents + wind + waves
    timestamp = latest_timestamp(all_records)
    if timestamp is None:
        from datetime import datetime, timezone
        timestamp = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")

    grid = _build_grid_metadata(sea_ice, currents, wind, waves)
    return {
        "timestamp": timestamp,
        "grid": grid,
        "sea_ice": sea_ice,
        "wind": wind,
        "waves": waves,
        "currents": currents,
        "meta": {
            "source_status": {
                "sea_ice": bool(sea_ice),
                "wind": bool(wind),
                "waves": bool(waves),
                "currents": bool(currents),
            },
            "counts": {
                "sea_ice": len(sea_ice), "wind": len(wind), "waves": len(waves), "currents": len(currents)
            },
            "max_points": max_points,
        },
    }


def _build_grid_metadata(*groups) -> Dict[str, Any]:
    points = [p for group in groups for p in group if p.get("latitude") is not None and p.get("longitude") is not None]
    if not points:
        return {"min_lat": None, "max_lat": None, "min_lon": None, "max_lon": None}
    return {
        "min_lat": min(p["latitude"] for p in points),
        "max_lat": max(p["latitude"] for p in points),
        "min_lon": min(p["longitude"] for p in points),
        "max_lon": max(p["longitude"] for p in points),
    }
