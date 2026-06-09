from fastapi import APIRouter, HTTPException
from typing import List
from backend.app.schemas.trials import TrialSchema, BulkTrialRequest
from backend.app.services.trial_service import TrialService

router = APIRouter()
trial_service = TrialService()

@router.post("/bulk-execute", response_model=List[TrialSchema])
async def bulk_execute_trials(req: BulkTrialRequest):
    """
    Attempts to strictly apply a Delta to multiple Runs. 
    If successful, executes the patched run and stores the trial result.
    """
    try:
        return trial_service.execute_bulk_trials(req.delta_id, req.run_ids, req.batch_size)
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("", response_model=List[TrialSchema])
async def list_trials():
    """Lists all execution trials."""
    try:
        return trial_service.list_trials()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/{trial_id}")
async def delete_trial(trial_id: str):
    """Deletes an execution trial by ID."""
    try:
        trial_service.delete_trial(trial_id)
        return {"status": "success", "message": f"Trial '{trial_id}' deleted."}
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/clear/{delta_id}")
async def clear_trials_for_delta(delta_id: str):
    """Clears all trials executed for a specific Delta."""
    try:
        trial_service.clear_trials_for_delta(delta_id)
        return {"status": "success", "message": f"All trials for Delta '{delta_id}' cleared."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))