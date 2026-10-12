from pathlib import Path
from typing import Any, Dict, List
import csv
import math

DATA_ROOT = Path(__file__).resolve().parents[2] / "data" / "sea_ice"


def _clamp(value: float, low: float = 0.0, high: float = 1.0) -> float:
    return max(low, min(high, value))


def _read_csv_rows(directory: Path) -> List[Dict[str, Any]]:
    rows: List[Dict[str, Any]] = []
    if not directory.exists():
        return rows
    for path in sorted(directory.glob("*.csv")):
        with path.open("r", encoding="utf-8", newline="") as f:
            rows.extend(csv.DictReader(f))
    return rows


def _read_netcdf_rows(directory: Path) -> List[Dict[str, Any]]:
    """Read common SIC NetCDF layouts without requiring one fixed dataset schema."""
    try:
        import xarray as xr
    except ImportError:
        return []

    rows: List[Dict[str, Any]] = []
    for path in sorted(list(directory.glob("*.nc")) + list(directory.glob("*.nc4"))):
        try:
            ds = xr.open_dataset(path)
            var = next((v for v in ("siconc", "sic", "sea_ice_concentration", "ice_concentration") if v in ds.data_vars), None)
            lat_name = next((v for v in ("latitude", "lat", "nav_lat") if v in ds.coords or v in ds.variables), None)
            lon_name = next((v for v in ("longitude", "lon", "nav_lon") if v in ds.coords or v in ds.variables), None)
            time_name = next((v for v in ("time", "valid_time", "datetime") if v in ds.coords or v in ds.variables), None)
            if not var or not lat_name or not lon_name:
                ds.close()
                continue

            da = ds[var]
            # Work with the latest time slice when a time dimension exists.
            if time_name and time_name in da.dims:
                da = da.isel({time_name: -1})
                timestamp = str(ds[time_name].values[-1])
            else:
                timestamp = None

            lat = ds[lat_name]
            lon = ds[lon_name]
            # Support 1-D regular grids and 2-D lat/lon grids.
            if lat.ndim == 1 and lon.ndim == 1:
                values = da.values
                if values.ndim > 2:
                    values = values.squeeze()
                for i, la in enumerate(lat.values):
                    for j, lo in enumerate(lon.values):
                        value = values[i, j]
                        if value == value and math.isfinite(float(value)):
                            c = float(value)
                            if c > 1.0:
                                c /= 100.0
                            rows.append({"timestamp": timestamp, "latitude": float(la), "longitude": float(lo), "concentration": _clamp(c)})
            else:
                values = da.values.squeeze()
                lat_values = lat.values
                lon_values = lon.values
                for idx in zip(*[range(n) for n in values.shape]):
                    value = values[idx]
                    if value != value:
                        continue
                    la = lat_values[idx] if getattr(lat_values, "shape", ()) == values.shape else lat_values[idx[0]]
                    lo = lon_values[idx] if getattr(lon_values, "shape", ()) == values.shape else lon_values[idx[-1]]
                    c = float(value)
                    if c > 1.0:
                        c /= 100.0
                    rows.append({"timestamp": timestamp, "latitude": float(la), "longitude": float(lo), "concentration": _clamp(c)})
            ds.close()
        except Exception:
            continue
    return rows


def load_sea_ice_data() -> List[Dict[str, Any]]:
    rows = _read_csv_rows(DATA_ROOT)
    output: List[Dict[str, Any]] = []
    for row in rows:
        try:
            output.append({
                "timestamp": row.get("timestamp"),
                "latitude": float(row["latitude"]),
                "longitude": float(row["longitude"]),
                "concentration": _clamp(float(row["concentration"])),
            })
        except (KeyError, TypeError, ValueError):
            continue
    if output:
        return output
    return _read_netcdf_rows(DATA_ROOT)


def get_latest_sea_ice() -> List[Dict[str, Any]]:
    return load_sea_ice_data()


def sea_ice_risk(concentration: float) -> float:
    return _clamp(float(concentration))
