from fastapi import APIRouter
from backend.app.api.endpoints import runs

api_router = APIRouter()
api_router.include_router(runs.router, prefix="/runs")
