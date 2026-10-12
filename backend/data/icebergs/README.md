# Iceberg data

Phase 2 uses real historical iceberg observations when they are placed in this directory.

## Recommended CSV format

```csv
iceberg_id,timestamp,latitude,longitude,risk_radius_km
IB001,2026-08-20T00:00:00Z,-61.20,68.40,25
IB001,2026-08-21T00:00:00Z,-61.10,68.70,25
IB001,2026-08-22T00:00:00Z,-60.95,69.10,25
IB002,2026-08-22T00:00:00Z,-63.20,71.40,30
```

The loader also accepts common aliases such as `id`, `lat`, `lon`, `datetime`, and `radius_km`.

## What the backend calculates

For every iceberg with at least two observations:

1. Sort observations by timestamp.
2. Take the latest observation as the current position.
3. Calculate latitude/longitude drift per hour from the previous observation.
4. Calculate movement speed in km/h.
5. Predict positions at 24 h and 48 h using the prototype drift model.
6. Calculate a bounded danger radius.
7. Expose the recent track and prediction through the API.

This is the prototype model. It is not the production physics + ML residual model.
