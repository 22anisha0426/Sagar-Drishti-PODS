from fastapi import APIRouter, HTTPException, Query

from app.models.schemas import RouteRequest, RouteResponse, ReplanRequest, ReplanResponse
from app.services.route_service import calculate_routes
from app.services.rl_service import replan_route_with_rl

router = APIRouter(prefix="/api", tags=["Routing"])


@router.post("/routes", response_model=RouteResponse)
def calculate_route_pair(
    request: RouteRequest,
    rows: int = Query(40, ge=5, le=150),
    cols: int = Query(40, ge=5, le=150),
    max_points: int = Query(5000, ge=100, le=50000),
):
    """Calculate fastest and safest routes over the live multi-hazard risk grid."""
    try:
        return calculate_routes(
            start_lat=request.start.lat,
            start_lon=request.start.lon,
            destination_lat=request.destination.lat,
            destination_lon=request.destination.lon,
            speed_knots=request.vessel.speed_knots,
            ice_class=request.vessel.ice_class,
            rows=rows,
            cols=cols,
            max_points=max_points,
        )
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Unable to calculate routes: {exc}") from exc


@router.post("/replan", response_model=ReplanResponse)
def replan_route(
    request: ReplanRequest,
    rows: int = Query(40, ge=5, le=150),
    cols: int = Query(40, ge=5, le=150),
    max_points: int = Query(5000, ge=100, le=50000),
):
    """Detect a hazard, halt if necessary, and use a Q-learning policy to replan."""
    if request.mode not in {"RL", "A_STAR", "DIJKSTRA"}:
        raise HTTPException(status_code=400, detail="mode must be one of RL, A_STAR or DIJKSTRA.")
    if request.mode != "RL":
        raise HTTPException(status_code=400, detail="Phase 6 replanning is implemented for mode='RL'.")

    try:
        return replan_route_with_rl(request, rows=rows, cols=cols, max_points=max_points)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Unable to replan route: {exc}") from exc
