from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.router import api_router


app = FastAPI(
    title="SAGAR-DRISHTI API",
    description=(
        "AI-Enabled Antarctic Sea-Ice, Iceberg Trajectory, "
        "and Navigation Decision Support System"
    ),
    version="0.1.0",
)


# ---------------------------------------------------------
# CORS
# ---------------------------------------------------------
# Allows the React/Vite frontend to communicate with FastAPI
# during development.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------
# API ROUTES
# ---------------------------------------------------------
app.include_router(api_router)


# ---------------------------------------------------------
# ROOT ENDPOINT
# ---------------------------------------------------------
@app.get("/")
def root():
    return {
        "name": "SAGAR-DRISHTI",
        "description": (
            "AI-Enabled Antarctic Sea-Ice, Iceberg Trajectory, "
            "and Navigation Decision Support System"
        ),
        "status": "running",
        "version": "0.1.0",
        "docs": "/docs",
    }


# ---------------------------------------------------------
# HEALTH CHECK
# ---------------------------------------------------------
@app.get("/health")
def health_check():
    return {
        "status": "healthy",
        "service": "SAGAR-DRISHTI Backend",
    }