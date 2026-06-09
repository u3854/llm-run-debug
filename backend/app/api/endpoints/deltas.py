from fastapi import APIRouter, HTTPException
from typing import List
from backend.app.schemas.deltas import DeltaCreate, DeltaSchema
from backend.app.services.delta_service import DeltaService

router = APIRouter()
delta_service = DeltaService()

@router.post("", response_model=DeltaSchema)
async def create_delta(delta_in: DeltaCreate):
    """Creates a new strict prompt delta."""
    try:
        return delta_service.create_delta(delta_in)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("", response_model=List[DeltaSchema])
async def list_deltas():
    """Lists all saved deltas."""
    try:
        return delta_service.list_deltas()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))