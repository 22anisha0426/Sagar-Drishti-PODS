from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional, Tuple
import math
import os

import pandas as pd


DATA_DIR = Path(os.getenv("SAGAR_DATA_DIR", Path(__file__).resolve().parents[2] / "data"))
ICEBERG_DIR = DATA_DIR / "icebergs"
DEFAULT_HORIZONS_HOURS = (24, 48)
DEFAULT_BASE_RADIUS_KM = 25.0


def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    radius = 6371.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)
    a = (
        math.sin(dphi / 2) ** 2
        + math.cos(p1) * math.cos(p2) * math.sin(dlambda / 2) ** 2
    )
    return 2 * radius * math.asin(math.sqrt(a))


def _find_column(df: pd.DataFrame, names: Iterable[str]) -> Optional[str]:
    normalized = {str(c).strip().lower().replace(" ", "_"): c for c in df.columns}
    for name in names:
        key = name.strip().lower().replace(" ", "_")
        if key in normalized:
            return normalized[key]
    return None


def _normalize_track_frame(df: pd.DataFrame) -> pd.DataFrame:
    """Normalize common iceberg CSV column names into a stable internal schema."""
    id_col = _find_column(df, ["id", "iceberg_id", "iceberg", "track_id", "object_id"])
    lat_col = _find_column(df, ["latitude", "lat", "y"])
    lon_col = _find_column(df, ["longitude", "lon", "lng", "x"])
    time_col = _find_column(df, ["timestamp", "datetime", "date", "time", "observation_time"])
    radius_col = _find_column(df, ["risk_radius_km", "danger_radius_km", "radius_km", "radius"])

    if lat_col is None or lon_col is None:
        raise ValueError("Iceberg data must contain latitude and longitude columns")

    out = pd.DataFrame()
    out["iceberg_id"] = df[id_col].astype(str) if id_col else "IB001"
    out["latitude"] = pd.to_numeric(df[lat_col], errors="coerce")
    out["longitude"] = pd.to_numeric(df[lon_col], errors="coerce")

    if time_col:
        out["timestamp"] = pd.to_datetime(df[time_col], errors="coerce", utc=True)
    else:
        out["timestamp"] = pd.Timestamp.now(tz="UTC")

    if radius_col:
        out["risk_radius_km"] = pd.to_numeric(df[radius_col], errors="coerce")
    else:
        out["risk_radius_km"] = DEFAULT_BASE_RADIUS_KM

    out = out.dropna(subset=["latitude", "longitude"])
    out = out[(out.latitude >= -90) & (out.latitude <= 90)]
    out = out[(out.longitude >= -180) & (out.longitude <= 180)]
    out["risk_radius_km"] = out["risk_radius_km"].fillna(DEFAULT_BASE_RADIUS_KM).clip(lower=1)
    out = out.sort_values(["iceberg_id", "timestamp"]).reset_index(drop=True)
    return out


def load_iceberg_tracks(path: Optional[str | Path] = None) -> pd.DataFrame:
    """Load iceberg observations from CSV or NetCDF/GRIB-like tabular data.

    For the prototype, CSV is preferred. NetCDF files are supported when xarray
    is installed and contain point observations with id/lat/lon/time variables.
    """
    target = Path(path) if path else ICEBERG_DIR

    if target.is_file():
        files = [target]
    elif target.exists():
        files = sorted([*target.glob("*.csv"), *target.glob("*.CSV"), *target.glob("*.nc"), *target.glob("*.netcdf")])
    else:
        files = []

    if not files:
        return pd.DataFrame(columns=["iceberg_id", "latitude", "longitude", "timestamp", "risk_radius_km"])

    frames: List[pd.DataFrame] = []
    for file in files:
        try:
            if file.suffix.lower() == ".csv":
                raw = pd.read_csv(file)
            else:
                import xarray as xr
                ds = xr.open_dataset(file)
                raw = ds.to_dataframe().reset_index()
                ds.close()
            frames.append(_normalize_track_frame(raw))
        except Exception as exc:
            # Keep one malformed file from taking down the entire API.
            print(f"[iceberg_service] Skipping {file.name}: {exc}")

    if not frames:
        return pd.DataFrame(columns=["iceberg_id", "latitude", "longitude", "timestamp", "risk_radius_km"])
    return pd.concat(frames, ignore_index=True).sort_values(["iceberg_id", "timestamp"]).reset_index(drop=True)


def _hours_between(previous: Any, current: Any) -> float:
    p = pd.Timestamp(previous)
    c = pd.Timestamp(current)
    seconds = (c - p).total_seconds()
    return seconds / 3600.0


def calculate_velocity(previous: Dict[str, float], current: Dict[str, float], hours: float) -> Tuple[float, float]:
    if hours <= 0:
        raise ValueError("hours must be greater than zero")
    return (
        (current["latitude"] - previous["latitude"]) / hours,
        (current["longitude"] - previous["longitude"]) / hours,
    )


def calculate_velocity_kmh(previous: Dict[str, float], current: Dict[str, float], hours: float) -> Dict[str, float]:
    distance = haversine_km(previous["latitude"], previous["longitude"], current["latitude"], current["longitude"])
    return {"speed_kmh": distance / hours if hours > 0 else 0.0, "distance_km": distance}


def predict_positions(
    current: Dict[str, float],
    velocity: Tuple[float, float],
    horizons_hours: Iterable[int] = DEFAULT_HORIZONS_HOURS,
) -> List[Dict[str, float]]:
    lat_v, lon_v = velocity
    return [
        {
            "hours": int(hours),
            "latitude": current["latitude"] + lat_v * hours,
            "longitude": current["longitude"] + lon_v * hours,
        }
        for hours in horizons_hours
    ]


def calculate_danger_radius_km(latitude: float, base_radius_km: float = DEFAULT_BASE_RADIUS_KM) -> float:
    latitude_factor = 1.0 + min(abs(latitude) / 90.0, 0.5)
    return base_radius_km * latitude_factor


def _serialize_timestamp(value: Any) -> str:
    ts = pd.Timestamp(value)
    if ts.tzinfo is None:
        ts = ts.tz_localize("UTC")
    return ts.isoformat().replace("+00:00", "Z")


def _latest_record(group: pd.DataFrame) -> pd.Series:
    return group.sort_values("timestamp").iloc[-1]


def build_iceberg_summary(df: pd.DataFrame, horizons_hours: Iterable[int] = DEFAULT_HORIZONS_HOURS) -> List[Dict[str, Any]]:
    summaries: List[Dict[str, Any]] = []
    if df.empty:
        return summaries

    for iceberg_id, group in df.groupby("iceberg_id", sort=True):
        group = group.sort_values("timestamp")
        current = _latest_record(group)
        current_point = {
            "latitude": float(current.latitude),
            "longitude": float(current.longitude),
        }

        velocity_deg_h = (0.0, 0.0)
        speed_info = {"speed_kmh": 0.0, "distance_km": 0.0}
        if len(group) >= 2:
            previous = group.iloc[-2]
            hours = _hours_between(previous.timestamp, current.timestamp)
            if hours > 0:
                previous_point = {"latitude": float(previous.latitude), "longitude": float(previous.longitude)}
                velocity_deg_h = calculate_velocity(previous_point, current_point, hours)
                speed_info = calculate_velocity_kmh(previous_point, current_point, hours)

        radius = calculate_danger_radius_km(float(current.latitude), float(current.risk_radius_km))
        predictions = predict_positions(current_point, velocity_deg_h, horizons_hours)
        for item in predictions:
            item["risk_radius_km"] = radius

        recent_track = [
            {
                "timestamp": _serialize_timestamp(row.timestamp),
                "latitude": float(row.latitude),
                "longitude": float(row.longitude),
            }
            for _, row in group.tail(100).iterrows()
        ]

        summaries.append({
            "id": str(iceberg_id),
            "latitude": float(current.latitude),
            "longitude": float(current.longitude),
            "timestamp": _serialize_timestamp(current.timestamp),
            "risk_radius_km": round(radius, 3),
            "velocity": {
                "latitude_deg_per_hour": velocity_deg_h[0],
                "longitude_deg_per_hour": velocity_deg_h[1],
                **speed_info,
            },
            "predicted_positions": predictions,
            "track": recent_track,
        })
    return summaries


def get_iceberg_tracks(path: Optional[str | Path] = None, limit: Optional[int] = None) -> List[Dict[str, Any]]:
    summaries = build_iceberg_summary(load_iceberg_tracks(path))
    return summaries[:limit] if limit else summaries


def get_iceberg(iceberg_id: str, path: Optional[str | Path] = None) -> Optional[Dict[str, Any]]:
    df = load_iceberg_tracks(path)
    if df.empty:
        return None
    subset = df[df["iceberg_id"].astype(str) == str(iceberg_id)]
    if subset.empty:
        return None
    summaries = build_iceberg_summary(subset)
    return summaries[0] if summaries else None


def iceberg_risk(vessel_lat: float, vessel_lon: float, icebergs: Iterable[Dict[str, Any]]) -> float:
    maximum_risk = 0.0
    for iceberg in icebergs:
        try:
            distance = haversine_km(vessel_lat, vessel_lon, float(iceberg["latitude"]), float(iceberg["longitude"]))
            radius = float(iceberg.get("risk_radius_km", DEFAULT_BASE_RADIUS_KM))
        except (KeyError, TypeError, ValueError):
            continue
        if radius <= 0:
            continue
        maximum_risk = max(maximum_risk, max(0.0, 1.0 - distance / radius))
    return min(maximum_risk, 1.0)


def data_status(path: Optional[str | Path] = None) -> Dict[str, Any]:
    df = load_iceberg_tracks(path)
    return {
        "available": not df.empty,
        "records": int(len(df)),
        "icebergs": int(df["iceberg_id"].nunique()) if not df.empty else 0,
        "directory": str(Path(path) if path else ICEBERG_DIR),
        "last_updated": _serialize_timestamp(df["timestamp"].max()) if not df.empty else None,
    }
