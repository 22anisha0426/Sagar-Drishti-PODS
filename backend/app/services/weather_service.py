from pathlib import Path
from typing import Any, Dict, List
import csv
import math

DATA_ROOT = Path(__file__).resolve().parents[2] / "data" / "weather"


def _read_csv_rows() -> List[Dict[str, Any]]:
    rows = []
    if not DATA_ROOT.exists():
        return rows
    for path in sorted(DATA_ROOT.glob("*.csv")):
        with path.open("r", encoding="utf-8", newline="") as f:
            rows.extend(csv.DictReader(f))
    return rows


def get_latest_weather() -> Dict[str, Any]:
    rows = _read_csv_rows()
    wind, waves = [], []
    for row in rows:
        common = {"timestamp": row.get("timestamp"), "latitude": _num(row.get("latitude")), "longitude": _num(row.get("longitude"))}
        try:
            if row.get("wind_speed") not in (None, ""):
                wind.append({**common, "speed": float(row["wind_speed"]), "direction": float(row["wind_direction"]) if row.get("wind_direction") else None})
        except (TypeError, ValueError):
            pass
        try:
            if row.get("wave_height") not in (None, ""):
                waves.append({**common, "height": float(row["wave_height"]), "period": float(row["wave_period"]) if row.get("wave_period") else None})
        except (TypeError, ValueError):
            pass
    if wind or waves:
        return {"wind": wind, "waves": waves}
    return _load_netcdf()


def _num(value):
    if value in (None, ""):
        return None
    try: return float(value)
    except (TypeError, ValueError): return None


def _load_netcdf() -> Dict[str, Any]:
    try:
        import xarray as xr
    except ImportError:
        return {"wind": [], "waves": []}
    wind, waves = [], []
    for path in sorted(list(DATA_ROOT.glob("*.nc")) + list(DATA_ROOT.glob("*.nc4"))):
        try:
            ds = xr.open_dataset(path)
            lat_name = next((v for v in ("latitude", "lat") if v in ds.coords or v in ds.variables), None)
            lon_name = next((v for v in ("longitude", "lon") if v in ds.coords or v in ds.variables), None)
            time_name = next((v for v in ("time", "valid_time") if v in ds.coords or v in ds.variables), None)
            if not lat_name or not lon_name:
                ds.close(); continue
            names = {k: next((v for v in vals if v in ds.data_vars), None) for k, vals in {
                "wind_speed": ("wind_speed", "ws", "si10"), "wind_direction": ("wind_direction", "wd", "wdir"),
                "wave_height": ("wave_height", "swh", "VHM0"), "wave_period": ("wave_period", "mwp", "VTM02")}.items()}
            timestamp = str(ds[time_name].values[-1]) if time_name and time_name in ds.coords else None
            lat, lon = ds[lat_name].values, ds[lon_name].values
            for i, la in enumerate(lat):
                for j, lo in enumerate(lon):
                    common = {"timestamp": timestamp, "latitude": float(la), "longitude": float(lo)}
                    if names["wind_speed"]:
                        da = ds[names["wind_speed"]]
                        if time_name and time_name in da.dims: da = da.isel({time_name:-1})
                        val = float(da.values.squeeze()[i,j])
                        if math.isfinite(val): wind.append({**common, "speed": val, "direction": None})
                    if names["wave_height"]:
                        da = ds[names["wave_height"]]
                        if time_name and time_name in da.dims: da = da.isel({time_name:-1})
                        val = float(da.values.squeeze()[i,j])
                        if math.isfinite(val): waves.append({**common, "height": val, "period": None})
            ds.close()
        except Exception:
            continue
    return {"wind": wind, "waves": waves}


def wind_risk(wind_speed: float, threshold: float = 30.0) -> float:
    if threshold <= 0: raise ValueError("threshold must be greater than zero")
    return min(max(wind_speed / threshold, 0.0), 1.0)


def wave_risk(wave_height: float, threshold: float = 6.0) -> float:
    if threshold <= 0: raise ValueError("threshold must be greater than zero")
    return min(max(wave_height / threshold, 0.0), 1.0)
