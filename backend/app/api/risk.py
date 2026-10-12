from fastapi import APIRouter, HTTPException, Query

from app.services.risk_grid_service import build_risk_grid

router = APIRouter(prefix="/api", tags=["Risk"])


@router.get("/risk/grid")
def risk_grid(
    rows: int = Query(40, ge=5, le=150),
    cols: int = Query(40, ge=5, le=150),
    max_points: int = Query(5000, ge=100, le=50000),
):
    """Return the current multi-hazard spatial risk grid."""
    try:
        return build_risk_grid(rows=rows, cols=cols, max_environment_points=max_points)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Unable to build risk grid: {exc}") from exc
