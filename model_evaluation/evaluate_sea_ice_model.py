from pathlib import Path
import math

import numpy as np
import pandas as pd

from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import (
    mean_absolute_error,
    mean_squared_error,
    r2_score,
)


# ============================================================
# CONFIGURATION
# ============================================================

# Assumes CSV is in the same folder as this script.
DATASET = Path(__file__).parent / "sea_ice_concentration_processed.csv"

LAGS = (1, 2, 3)

MAX_TRAIN_ROWS = 120_000

RANDOM_STATE = 42


# ============================================================
# LOAD DATA
# ============================================================

print("=" * 70)
print("SEA-ICE CONCENTRATION MODEL EVALUATION")
print("=" * 70)

print("\nLoading dataset:")
print(DATASET)

if not DATASET.exists():
    raise FileNotFoundError(
        f"\nDataset not found:\n{DATASET}\n\n"
        "Place sea_ice_concentration_processed.csv in the same "
        "folder as this script."
    )

df = pd.read_csv(DATASET)

print(f"\nOriginal dataset shape: {df.shape}")

print("\nColumns:")
print(df.columns.tolist())


# ============================================================
# CHECK REQUIRED COLUMNS
# ============================================================

required = {
    "timestamp",
    "latitude",
    "longitude",
    "concentration",
}

missing = required - set(df.columns)

if missing:
    raise ValueError(
        f"Missing required columns: {sorted(missing)}"
    )


# ============================================================
# DATA PREPROCESSING
# ============================================================

df["timestamp"] = pd.to_datetime(
    df["timestamp"],
    utc=True,
    errors="coerce",
)

df["latitude"] = pd.to_numeric(
    df["latitude"],
    errors="coerce",
)

df["longitude"] = pd.to_numeric(
    df["longitude"],
    errors="coerce",
)

df["concentration"] = pd.to_numeric(
    df["concentration"],
    errors="coerce",
)


# Remove invalid observations

df = df.dropna(
    subset=[
        "timestamp",
        "latitude",
        "longitude",
        "concentration",
    ]
)


# Keep concentration between 0 and 1

df["concentration"] = np.clip(
    df["concentration"],
    0.0,
    1.0,
)


# Sort exactly like the service

df = (
    df
    .sort_values(
        ["latitude", "longitude", "timestamp"]
    )
    .reset_index(drop=True)
)


print(
    f"\nClean dataset shape: {df.shape}"
)


# ============================================================
# CREATE LAG FEATURES
# ============================================================

print("\nCreating lag features...")

group = df.groupby(
    ["latitude", "longitude"],
    sort=False
)["concentration"]


for lag in LAGS:

    df[f"lag_{lag}"] = group.shift(lag)


# ============================================================
# CALENDAR FEATURES
# ============================================================

df["hour"] = df["timestamp"].dt.hour

df["day_of_year"] = (
    df["timestamp"].dt.dayofyear
)


df["hour_sin"] = np.sin(
    2 * np.pi * df["hour"] / 24.0
)

df["hour_cos"] = np.cos(
    2 * np.pi * df["hour"] / 24.0
)

df["doy_sin"] = np.sin(
    2 * np.pi * df["day_of_year"] / 365.25
)

df["doy_cos"] = np.cos(
    2 * np.pi * df["day_of_year"] / 365.25
)


# Remove rows without enough history

feature_columns = [
    "latitude",
    "longitude",
    "lag_1",
    "lag_2",
    "lag_3",
    "hour_sin",
    "hour_cos",
    "doy_sin",
    "doy_cos",
]


df = df.dropna(
    subset=[
        "lag_1",
        "lag_2",
        "lag_3",
    ]
).reset_index(drop=True)


print(
    f"Usable supervised rows: {len(df):,}"
)


# ============================================================
# TIME-ORDERED TRAIN / TEST SPLIT
# ============================================================

print("\nCreating chronological train/test split...")

# IMPORTANT:
# Split BEFORE limiting the number of training rows.
# Otherwise, taking the most recent rows can remove
# the historical period needed for validation.

cutoff = df["timestamp"].quantile(0.80)

train = df[
    df["timestamp"] <= cutoff
].copy()

test = df[
    df["timestamp"] > cutoff
].copy()


print(
    f"\nTraining observations: {len(train):,}"
)

print(
    f"Testing observations : {len(test):,}"
)

print(
    f"Training period      : "
    f"{train['timestamp'].min()} → "
    f"{train['timestamp'].max()}"
)

print(
    f"Testing period       : "
    f"{test['timestamp'].min()} → "
    f"{test['timestamp'].max()}"
)


if test.empty:

    raise ValueError(
        "Test dataset is empty. "
        "Check that the dataset contains multiple timestamps."
    )


# ============================================================
# LIMIT TRAINING DATA ONLY
# ============================================================

if len(train) > MAX_TRAIN_ROWS:

    print(
        f"\nTraining set exceeds {MAX_TRAIN_ROWS:,} rows."
    )

    print(
        f"Using the most recent {MAX_TRAIN_ROWS:,} "
        "training rows."
    )

    train = (
        train
        .sort_values("timestamp")
        .tail(MAX_TRAIN_ROWS)
        .reset_index(drop=True)
    )

# ============================================================
# CREATE MODEL
# ============================================================

print("\nTraining Random Forest model...")

model = RandomForestRegressor(
    n_estimators=160,
    max_depth=18,
    min_samples_leaf=2,
    n_jobs=-1,
    random_state=RANDOM_STATE,
)


# ============================================================
# TRAIN
# ============================================================

model.fit(
    train[feature_columns],
    train["concentration"],
)


print("Model training completed.")


# ============================================================
# PREDICTION
# ============================================================

print("\nGenerating predictions...")

predictions = model.predict(
    test[feature_columns]
)

predictions = np.clip(
    predictions,
    0.0,
    1.0,
)

actual = test[
    "concentration"
].to_numpy()


# ============================================================
# METRICS
# ============================================================

mae = mean_absolute_error(
    actual,
    predictions,
)

rmse = math.sqrt(
    mean_squared_error(
        actual,
        predictions,
    )
)

r2 = r2_score(
    actual,
    predictions,
)


# Mean Bias Error

bias = np.mean(
    predictions - actual
)


# ============================================================
# ACCURACY-LIKE THRESHOLD METRICS
# ============================================================

absolute_error = np.abs(
    predictions - actual
)


within_005 = (
    np.mean(
        absolute_error <= 0.05
    ) * 100
)

within_010 = (
    np.mean(
        absolute_error <= 0.10
    ) * 100
)

within_020 = (
    np.mean(
        absolute_error <= 0.20
    ) * 100
)


# ============================================================
# PRINT RESULTS
# ============================================================

print("\n")
print("=" * 70)
print("MODEL EVALUATION RESULTS")
print("=" * 70)

print(
    f"\nTest samples              : {len(actual):,}"
)

print(
    f"MAE                       : {mae:.6f}"
)

print(
    f"RMSE                      : {rmse:.6f}"
)

print(
    f"R²                        : {r2:.6f}"
)

print(
    f"Mean Bias Error           : {bias:.6f}"
)

print(
    f"\nWithin ±0.05 concentration: "
    f"{within_005:.2f}%"
)

print(
    f"Within ±0.10 concentration: "
    f"{within_010:.2f}%"
)

print(
    f"Within ±0.20 concentration: "
    f"{within_020:.2f}%"
)


# ============================================================
# ADD RESULTS TO DATAFRAME
# ============================================================

evaluation = test[
    [
        "timestamp",
        "latitude",
        "longitude",
        "concentration",
    ]
].copy()

evaluation["predicted_concentration"] = (
    predictions
)

evaluation["absolute_error"] = (
    absolute_error
)


# ============================================================
# SAVE RESULTS
# ============================================================

output_file = (
    Path(__file__).parent
    / "sea_ice_evaluation_results.csv"
)

evaluation.to_csv(
    output_file,
    index=False,
)


print(
    f"\nDetailed predictions saved to:"
)

print(
    output_file
)


# ============================================================
# MODEL INTERPRETATION
# ============================================================

print("\n")
print("=" * 70)
print("INTERPRETATION")
print("=" * 70)

print(
    f"\nAverage prediction error (MAE): "
    f"{mae:.4f} concentration units."
)

print(
    f"RMSE: {rmse:.4f} concentration units."
)

print(
    f"R²: {r2:.4f}"
)

print(
    f"\n{within_010:.2f}% of predictions "
    f"are within ±0.10 concentration units "
    f"of the observed value."
)

print("\nEvaluation completed.")
