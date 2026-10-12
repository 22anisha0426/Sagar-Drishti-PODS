from fastapi import APIRouter, HTTPException, Query

from app.services.iceberg_service import data_status, get_iceberg, get_iceberg_tracks

router = APIRouter(prefix="/api", tags=["Icebergs"])


@router.get("/icebergs")
def list_icebergs(
    limit: int = Query(100, ge=1, le=1000),
):
    """Return the latest observation, drift estimate and predicted positions for each iceberg."""
    icebergs = get_iceberg_tracks(limit=limit)
    return {
        "icebergs": icebergs,
        "count": len(icebergs),
        "data_status": data_status(),
    }


@router.get("/icebergs/status")
def iceberg_data_status():
    """Return whether usable iceberg observations are available to the API."""
    return data_status()


@router.get("/icebergs/{iceberg_id}")
def get_one_iceberg(iceberg_id: str):
    """Return one iceberg's recent historical track and 24/48-hour trajectory prediction."""
    iceberg = get_iceberg(iceberg_id)
    if iceberg is None:
        raise HTTPException(status_code=404, detail=f"Iceberg '{iceberg_id}' not found")
    return iceberg
