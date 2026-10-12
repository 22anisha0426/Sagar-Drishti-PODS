from fastapi import APIRouter
from app.api.environment import router as environment_router
from app.api.iceberg import router as iceberg_router
from app.api.routes import router as routes_router
from app.api.forecast import router as forecast_router
from app.api.simulation import router as simulation_router
from app.api.risk import router as risk_router
from app.api.system import router as system_router

api_router = APIRouter()
api_router.include_router(environment_router)
api_router.include_router(iceberg_router)
api_router.include_router(routes_router)
api_router.include_router(forecast_router)
api_router.include_router(simulation_router)
api_router.include_router(risk_router)
api_router.include_router(system_router)
