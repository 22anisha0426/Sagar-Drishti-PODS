from fastapi import APIRouter

from app.services.db_service import status as database_status
from app.services.environment_service import get_environment
from app.services.iceberg_service import data_status as iceberg_status

router = APIRouter(prefix="/api", tags=["System"])


@router.get("/system/status")
def system_status():
    environment = get_environment(max_points=1000)
    return {
        "service": "SAGAR-DRISHTI Backend",
        "status": "ready",
        "data": {
            "environment": environment.get("meta", {}).get("source_status", {}),
            "icebergs": iceberg_status(),
        },
        "database": database_status(),
    }
