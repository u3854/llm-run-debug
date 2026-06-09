from fastapi import APIRouter
from backend.app.api.endpoints import runs, deltas, trials

api_router = APIRouter()
api_router.include_router(runs.router, prefix="/runs")
api_router.include_router(deltas.router, prefix="/deltas", tags=["deltas"])
api_router.include_router(trials.router, prefix="/trials", tags=["trials"])
