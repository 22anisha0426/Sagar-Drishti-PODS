"""Prototype sea-ice concentration forecasting using the project's real SIC data.

The model is intentionally lightweight for the SIH prototype. It learns short-term
temporal persistence from historical SIC at each grid cell using strictly consecutive
daily lagged concentration and calendar features. RandomForest tree predictions
provide an empirical uncertainty band (P10/P50/P90). No synthetic/mock forecast
values are used.
"""
from __future__ import annotations

from datetime import datetime, timezone
from functools import lru_cache
from typing import Any, Dict, List, Tuple

import math
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import mean_absolute_error, mean_squared_error

from app.services.ice_service import load_sea_ice_data


LAGS = (1, 2, 3)
MAX_TRAIN_ROWS = 120_000
RANDOM_STATE = 42


def _parse_timestamp(value: Any) -> pd.Timestamp:
    ts = pd.to_datetime(value, utc=True, errors="coerce")
    return ts


def _prepare_dataframe(rows: List[Dict[str, Any]]) -> pd.DataFrame:
    if not rows:
        raise ValueError("No sea-ice observations were found in backend/data/sea_ice.")

    df = pd.DataFrame(rows)
    required = {"timestamp", "latitude", "longitude", "concentration"}
    missing = required - set(df.columns)
    if missing:
        raise ValueError(f"Sea-ice data is missing columns: {sorted(missing)}")

    df["timestamp"] = pd.to_datetime(df["timestamp"], utc=True, errors="coerce")
    df["latitude"] = pd.to_numeric(df["latitude"], errors="coerce")
    df["longitude"] = pd.to_numeric(df["longitude"], errors="coerce")
    df["concentration"] = pd.to_numeric(df["concentration"], errors="coerce")
    df = df.dropna(subset=["timestamp", "latitude", "longitude", "concentration"])
    df["concentration"] = np.clip(df["concentration"], 0.0, 1.0)

    # Collapse accidental duplicate observations at the same grid/time point.
    df = (
        df.groupby(["timestamp", "latitude", "longitude"], as_index=False)["concentration"]
        .mean()
        .sort_values(["latitude", "longitude", "timestamp"])
    )
    return df


def _infer_step(df: pd.DataFrame) -> pd.Timedelta:
    diffs = df.groupby(["latitude", "longitude"])["timestamp"].diff().dropna()
    if diffs.empty:
        return pd.Timedelta(hours=24)
    seconds = diffs.dt.total_seconds()
    seconds = seconds[seconds > 0]
    if seconds.empty:
        return pd.Timedelta(hours=24)
    # Median is robust to missing timestamps and duplicated downloads.
    return pd.to_timedelta(float(seconds.median()), unit="s")


def _feature_frame(df: pd.DataFrame) -> pd.DataFrame:
    """
    Build lag features only from genuinely consecutive daily observations.

    This prevents a long data gap (for example, several weeks) from being
    interpreted as lag_1/lag_2/lag_3. For this daily AMSR2 dataset:
        lag_1 = t - 24h
        lag_2 = t - 48h
        lag_3 = t - 72h
    """
    work = df.copy()
    work = work.sort_values(["latitude", "longitude", "timestamp"]).reset_index(drop=True)

    # Reindex each spatial cell onto its complete daily timeline. Missing
    # dates become NaN, so they cannot accidentally become lagged values.
    pieces = []
    for (lat, lon), cell in work.groupby(["latitude", "longitude"], sort=False):
        cell = cell.set_index("timestamp").sort_index()
        full_index = pd.date_range(
            cell.index.min(), cell.index.max(), freq="24h", tz="UTC"
        )
        cell = cell.reindex(full_index)
        cell.index.name = "timestamp"
        cell["latitude"] = lat
        cell["longitude"] = lon
        pieces.append(cell.reset_index())

    work = pd.concat(pieces, ignore_index=True)
    group = work.groupby(["latitude", "longitude"], sort=False)["concentration"]

    for lag in LAGS:
        work[f"lag_{lag}"] = group.shift(lag)

    work["hour"] = work["timestamp"].dt.hour
    work["day_of_year"] = work["timestamp"].dt.dayofyear
    work["hour_sin"] = np.sin(2 * np.pi * work["hour"] / 24.0)
    work["hour_cos"] = np.cos(2 * np.pi * work["hour"] / 24.0)
    work["doy_sin"] = np.sin(2 * np.pi * work["day_of_year"] / 365.25)
    work["doy_cos"] = np.cos(2 * np.pi * work["day_of_year"] / 365.25)

    # Target must also exist: this removes rows representing missing dates.
    return work.dropna(
        subset=["concentration"] + [f"lag_{lag}" for lag in LAGS]
    ).sort_values(["timestamp", "latitude", "longitude"]).reset_index(drop=True)


def _fit_model(df: pd.DataFrame) -> Tuple[RandomForestRegressor, Dict[str, float], pd.DataFrame]:
    features = [
        "latitude", "longitude", "lag_1", "lag_2", "lag_3",
        "hour_sin", "hour_cos", "doy_sin", "doy_cos",
    ]
    supervised = _feature_frame(df)
    if len(supervised) < 30:
        raise ValueError(
            f"Not enough historical SIC observations for the lagged model ({len(supervised)} usable rows; need at least 30)."
        )

    # Keep the most recent rows when a scientific grid is very large.
    if len(supervised) > MAX_TRAIN_ROWS:
        supervised = supervised.sort_values("timestamp").tail(MAX_TRAIN_ROWS)

    # Time-ordered holdout for honest prototype metrics.
    cutoff = supervised["timestamp"].quantile(0.80)
    train = supervised[supervised["timestamp"] <= cutoff]
    test = supervised[supervised["timestamp"] > cutoff]
    if len(train) < 20:
        train = supervised
        test = supervised.iloc[0:0]

    model = RandomForestRegressor(
        n_estimators=160,
        max_depth=18,
        min_samples_leaf=2,
        n_jobs=-1,
        random_state=RANDOM_STATE,
    )
    model.fit(train[features], train["concentration"])

    metrics: Dict[str, float] = {}
    if not test.empty:
        pred = np.clip(model.predict(test[features]), 0.0, 1.0)
        metrics["mae"] = float(mean_absolute_error(test["concentration"], pred))
        metrics["rmse"] = float(math.sqrt(mean_squared_error(test["concentration"], pred)))
        metrics["test_rows"] = float(len(test))
    else:
        metrics["mae"] = float("nan")
        metrics["rmse"] = float("nan")
        metrics["test_rows"] = 0.0
    return model, metrics, supervised


def _ensemble_percentiles(model: RandomForestRegressor, X: pd.DataFrame) -> Tuple[np.ndarray, np.ndarray, np.ndarray]:
    tree_preds = np.vstack([tree.predict(X) for tree in model.estimators_])
    p10, p50, p90 = np.percentile(tree_preds, [10, 50, 90], axis=0)
    return np.clip(p10, 0, 1), np.clip(p50, 0, 1), np.clip(p90, 0, 1)


def _predict_grid(model: RandomForestRegressor, df: pd.DataFrame, step: pd.Timedelta, hours: int) -> pd.DataFrame:
    # Forecast by recursively advancing each observed grid cell.
    features = [
        "latitude", "longitude", "lag_1", "lag_2", "lag_3",
        "hour_sin", "hour_cos", "doy_sin", "doy_cos",
    ]
    latest = df.sort_values("timestamp").groupby(["latitude", "longitude"], sort=False)
    records: List[Dict[str, Any]] = []
    steps = max(1, int(round(pd.Timedelta(hours=hours) / step)))

    for (lat, lon), cell in latest:
        cell = cell.sort_values("timestamp").tail(3)
        if len(cell) < 3:
            continue

        timestamps = list(cell["timestamp"])
        if not (
            timestamps[1] - timestamps[0] == step
            and timestamps[2] - timestamps[1] == step
        ):
            continue

        history = list(cell["concentration"].astype(float).values)
        timestamp = timestamps[-1]
        for _ in range(steps):
            timestamp = timestamp + step
            doy = timestamp.dayofyear
            X = pd.DataFrame([{
                "latitude": float(lat),
                "longitude": float(lon),
                "lag_1": history[-1],
                "lag_2": history[-2],
                "lag_3": history[-3],
                "hour_sin": math.sin(2 * math.pi * timestamp.hour / 24.0),
                "hour_cos": math.cos(2 * math.pi * timestamp.hour / 24.0),
                "doy_sin": math.sin(2 * math.pi * doy / 365.25),
                "doy_cos": math.cos(2 * math.pi * doy / 365.25),
            }], columns=features)
            p10, p50, p90 = _ensemble_percentiles(model, X)
            prediction = float(p50[0])
            history.append(prediction)

        records.append({
            "latitude": float(lat),
            "longitude": float(lon),
            "timestamp": timestamp.isoformat(),
            "p10": float(p10[0]),
            "p50": float(p50[0]),
            "p90": float(p90[0]),
        })
    return pd.DataFrame(records)


@lru_cache(maxsize=1)
def _build_model() -> Tuple[RandomForestRegressor, Dict[str, float], pd.DataFrame, pd.Timedelta]:
    df = _prepare_dataframe(load_sea_ice_data())
    model, metrics, supervised = _fit_model(df)
    step = _infer_step(df)
    return model, metrics, df, step


def clear_forecast_cache() -> None:
    _build_model.cache_clear()


def get_forecast(hours: Tuple[int, ...] = (0, 24, 48)) -> Dict[str, Any]:
    model, metrics, df, step = _build_model()
    latest_timestamp = df["timestamp"].max()
    current = df[df["timestamp"] == latest_timestamp]["concentration"]
    if current.empty:
        current = df.sort_values("timestamp").groupby(["latitude", "longitude"]).tail(1)["concentration"]

    forecast: List[Dict[str, Any]] = [{
        "horizon": "CURRENT",
        "hours": 0,
        "p10": float(np.percentile(current, 10)),
        "p50": float(np.percentile(current, 50)),
        "p90": float(np.percentile(current, 90)),
        "observed": True,
    }]

    for h in (24, 48):
        grid = _predict_grid(model, df, step, h)
        if grid.empty:
            raise ValueError(f"Unable to produce a {h}-hour forecast from the available SIC history.")
        forecast.append({
            "horizon": f"{h} HOURS",
            "hours": h,
            "p10": float(grid["p10"].mean()),
            "p50": float(grid["p50"].mean()),
            "p90": float(grid["p90"].mean()),
            "observed": False,
            "grid_points": int(len(grid)),
        })

    return {
        "model": {
            "name": "RandomForest lagged SIC baseline",
            "type": "prototype_temporal_baseline",
            "training_rows": int(len(df)),
            "grid_points": int(df[["latitude", "longitude"]].drop_duplicates().shape[0]),
            "time_step_hours": float(step.total_seconds() / 3600.0),
            "validation": metrics,
        },
        "latest_observation": latest_timestamp.isoformat(),
        "forecast": forecast,
    }


def get_forecast_grid(hours: int = 24, max_points: int = 5000) -> Dict[str, Any]:
    if hours not in (24, 48):
        raise ValueError("hours must be 24 or 48")
    model, metrics, df, step = _build_model()
    grid = _predict_grid(model, df, step, hours)
    if len(grid) > max_points:
        grid = grid.sample(max_points, random_state=RANDOM_STATE)
    return {
        "hours": hours,
        "latest_observation": df["timestamp"].max().isoformat(),
        "points": grid.to_dict(orient="records"),
        "count": int(len(grid)),
        "model": metrics,
    }
