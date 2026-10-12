from fastapi import APIRouter, Query
from app.services.environment_service import get_environment

router = APIRouter(prefix="/api", tags=["Environment"])


@router.get("/environment")
def environment(max_points: int = Query(5000, ge=100, le=50000)):
    """Return the harmonized environmental data loaded from backend/data."""
    return get_environment(max_points=max_points)
