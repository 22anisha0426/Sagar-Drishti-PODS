import pandas as pd
import numpy as np
from sklearn.metrics import mean_absolute_error, mean_squared_error

# ============================================================
# CONFIGURATION
# ============================================================

DATASET = "iceberg_tracks_processed.csv"

# ============================================================
# LOAD DATA
# ============================================================

df = pd.read_csv(DATASET)

print("Dataset shape:", df.shape)
print("Columns:", df.columns.tolist())

# Convert timestamp
df["timestamp"] = pd.to_datetime(df["timestamp"], errors="coerce")

# Sort correctly
df = df.sort_values(["iceberg_id", "timestamp"]).reset_index(drop=True)

# Remove invalid coordinates
df = df.dropna(subset=["latitude", "longitude"])

df = df[
    (df["latitude"] >= -90) &
    (df["latitude"] <= 90) &
    (df["longitude"] >= -180) &
    (df["longitude"] <= 180)
]

# Remove missing-coordinate records
df = df[
    ~((df["latitude"] == 0) & (df["longitude"] == 0))
]

print("Clean dataset:", df.shape)


# ============================================================
# HAVERSINE DISTANCE
# ============================================================

def haversine_km(lat1, lon1, lat2, lon2):

    R = 6371.0

    lat1 = np.radians(lat1)
    lat2 = np.radians(lat2)

    dlat = np.radians(lat2 - lat1)
    dlon = np.radians(lon2 - lon1)

    a = (
        np.sin(dlat / 2) ** 2
        +
        np.cos(lat1)
        * np.cos(lat2)
        * np.sin(dlon / 2) ** 2
    )

    return 2 * R * np.arcsin(np.sqrt(a))


# ============================================================
# EVALUATION
# ============================================================

results = {
    24: [],
    48: []
}


for iceberg_id, group in df.groupby("iceberg_id"):

    group = group.sort_values("timestamp").reset_index(drop=True)

    # Need at least 3 observations
    if len(group) < 3:
        continue

    for i in range(1, len(group) - 1):

        previous = group.iloc[i - 1]
        current = group.iloc[i]

        # Time between previous and current observation
        hours = (
            current["timestamp"] - previous["timestamp"]
        ).total_seconds() / 3600

        if hours <= 0:
            continue

        # ====================================================
        # SAME MODEL AS iceberg_service.py
        # ====================================================

        lat_velocity = (
            current["latitude"] - previous["latitude"]
        ) / hours

        lon_velocity = (
            current["longitude"] - previous["longitude"]
        ) / hours


        for horizon in [24, 48]:

            predicted_lat = (
                current["latitude"]
                + lat_velocity * horizon
            )

            predicted_lon = (
                current["longitude"]
                + lon_velocity * horizon
            )


            # Find actual observation closest to desired horizon
            target_time = (
                current["timestamp"]
                + pd.Timedelta(hours=horizon)
            )

            future = group[
                group["timestamp"] >= target_time
            ]

            if future.empty:
                continue

            actual = future.iloc[0]

            # Prediction error in km
            error = haversine_km(
                predicted_lat,
                predicted_lon,
                actual["latitude"],
                actual["longitude"]
            )

            results[horizon].append(error)


# ============================================================
# CALCULATE METRICS
# ============================================================

for horizon in [24, 48]:

    errors = np.array(results[horizon])

    if len(errors) == 0:
        print(f"\nNo results for {horizon}h")
        continue

    mae = np.mean(np.abs(errors))

    rmse = np.sqrt(
        np.mean(errors ** 2)
    )

    median_error = np.median(errors)

    within_10 = np.mean(errors <= 10) * 100
    within_25 = np.mean(errors <= 25) * 100
    within_50 = np.mean(errors <= 50) * 100

    print("\n" + "=" * 50)

    print(f"{horizon}-HOUR PREDICTION")

    print("=" * 50)

    print(f"Predictions evaluated : {len(errors)}")

    print(f"MAE                   : {mae:.2f} km")

    print(f"RMSE                  : {rmse:.2f} km")

    print(f"Median Error          : {median_error:.2f} km")

    print(f"Within 10 km          : {within_10:.2f}%")

    print(f"Within 25 km          : {within_25:.2f}%")

    print(f"Within 50 km          : {within_50:.2f}%")