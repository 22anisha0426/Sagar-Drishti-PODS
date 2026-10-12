from fastapi import APIRouter, HTTPException, Query

from app.services.sea_ice_forecast_service import get_forecast, get_forecast_grid

router = APIRouter(prefix="/api", tags=["Forecast"])


@router.get("/forecast")
def sea_ice_forecast():
    """Return current, 24h and 48h SIC forecasts from the real sea-ice dataset."""
    try:
        return get_forecast()
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Sea-ice forecasting failed: {exc}")


@router.get("/forecast/grid")
def sea_ice_forecast_grid(
    hours: int = Query(24, ge=24, le=48),
    max_points: int = Query(5000, ge=100, le=20000),
):
    """Return spatial P10/P50/P90 forecast points for the frontend map."""
    if hours not in (24, 48):
        raise HTTPException(status_code=400, detail="hours must be 24 or 48")
    try:
        return get_forecast_grid(hours=hours, max_points=max_points)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Sea-ice forecast grid failed: {exc}")
