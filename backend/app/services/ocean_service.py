from pathlib import Path
from typing import Any, Dict, List
import csv
import math

DATA_ROOT = Path(__file__).resolve().parents[2] / "data" / "ocean"


def load_ocean_data() -> List[Dict[str, Any]]:
    output: List[Dict[str, Any]] = []
    if DATA_ROOT.exists():
        for path in sorted(DATA_ROOT.glob("*.csv")):
            with path.open("r", encoding="utf-8", newline="") as f:
                for row in csv.DictReader(f):
                    try:
                        output.append({
                            "timestamp": row.get("timestamp"),
                            "latitude": float(row["latitude"]),
                            "longitude": float(row["longitude"]),
                            "speed": float(row["current_speed"]),
                            "direction": float(row["current_direction"]) if row.get("current_direction") else None,
                        })
                    except (KeyError, TypeError, ValueError):
                        continue
    if output:
        return output
    return _load_netcdf()


def _load_netcdf() -> List[Dict[str, Any]]:
    try:
        import xarray as xr
    except ImportError:
        return []
    output: List[Dict[str, Any]] = []
    files = sorted(list(DATA_ROOT.glob("*.nc")) + list(DATA_ROOT.glob("*.nc4")))
    for path in files:
        try:
            ds = xr.open_dataset(path)
            u_name = next((v for v in ("uo", "u", "eastward_sea_water_velocity") if v in ds.data_vars), None)
            v_name = next((v for v in ("vo", "v", "northward_sea_water_velocity") if v in ds.data_vars), None)
            lat_name = next((v for v in ("latitude", "lat") if v in ds.coords or v in ds.variables), None)
            lon_name = next((v for v in ("longitude", "lon") if v in ds.coords or v in ds.variables), None)
            time_name = next((v for v in ("time", "valid_time") if v in ds.coords or v in ds.variables), None)
            if not u_name or not v_name or not lat_name or not lon_name:
                ds.close(); continue
            u = ds[u_name]
            v = ds[v_name]
            if time_name and time_name in u.dims:
                u = u.isel({time_name: -1}); v = v.isel({time_name: -1})
                timestamp = str(ds[time_name].values[-1])
            else:
                timestamp = None
            u = u.squeeze(); v = v.squeeze()
            lat = ds[lat_name].values; lon = ds[lon_name].values
            vals_u, vals_v = u.values, v.values
            if vals_u.ndim != 2 or vals_v.ndim != 2 or getattr(lat, "ndim", 1) != 1 or getattr(lon, "ndim", 1) != 1:
                ds.close(); continue
            for i, la in enumerate(lat):
                for j, lo in enumerate(lon):
                    uu, vv = float(vals_u[i,j]), float(vals_v[i,j])
                    if math.isfinite(uu) and math.isfinite(vv):
                        output.append({"timestamp": timestamp, "latitude": float(la), "longitude": float(lo), "speed": math.hypot(uu,vv), "direction": (math.degrees(math.atan2(uu, vv)) + 360) % 360})
            ds.close()
        except Exception:
            continue
    return output


def current_risk(current_speed: float, threshold: float = 2.5) -> float:
    if threshold <= 0:
        raise ValueError("threshold must be greater than zero")
    return min(max(current_speed / threshold, 0.0), 1.0)
