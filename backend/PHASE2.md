# SAGAR-DRISHTI — Phase 2: Iceberg Data Integration

## Objective

Connect historical iceberg observations to the FastAPI backend and implement the prototype trajectory pipeline:

Historical track → velocity → drift estimate → future positions → danger radius → API output.

This is the prototype drift model. It is not the production physics + ML residual model.

## Data location

Place iceberg files in:

```text
data/icebergs/
```

Recommended CSV:

```csv
iceberg_id,timestamp,latitude,longitude,risk_radius_km
IB001,2026-08-20T00:00:00Z,-61.20,68.40,25
IB001,2026-08-21T00:00:00Z,-61.10,68.70,25
IB001,2026-08-22T00:00:00Z,-60.95,69.10,25
```

The loader accepts common aliases for ID, timestamp, latitude, longitude and radius.

## Endpoints

### GET /api/icebergs

Returns one summary per iceberg, including:

- latest position
- observation timestamp
- danger radius
- latitude/longitude drift per hour
- movement speed in km/h
- 24-hour prediction
- 48-hour prediction
- recent historical track

Optional:

```text
/api/icebergs?limit=100
```

### GET /api/icebergs/{iceberg_id}

Returns the complete processed summary for one iceberg.

### GET /api/icebergs/status

Returns whether usable iceberg observations are currently available and the number of records/icebergs loaded.

## Prediction method

For an iceberg with two or more observations:

1. Sort by timestamp.
2. Use the latest observation as the current position.
3. Calculate latitude/longitude degrees per hour from the latest two observations.
4. Calculate great-circle movement distance and speed in km/h.
5. Project the current velocity to 24 h and 48 h.
6. Calculate a bounded danger radius from the configured base radius and latitude.

## Important limitation

This implementation deliberately does not claim a production-grade physical iceberg model. The production architecture can later replace the drift projection with a physics Lagrangian model plus ML residual correction.
