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

@router.delete("/{delta_id}")
async def delete_delta(delta_id: str):
    """Deletes a strict prompt delta and all its trials."""
    try:
        delta_service.delete_delta(delta_id)
        return {"status": "success", "message": f"Delta '{delta_id}' and associated trials deleted."}
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))