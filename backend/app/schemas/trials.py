from pydantic import BaseModel, Field
from typing import Optional, Any, Dict, List

class TrialSchema(BaseModel):
    trial_id: str
    run_id: str
    delta_id: str
    status: str = Field(..., description="'applied', 'skipped', 'failed'")
    reason: Optional[str] = None
    patched_snapshot: Optional[Dict[str, Any]] = None
    output_snapshot: Optional[Dict[str, Any]] = None
    created_at: Optional[str] = None

class BulkTrialRequest(BaseModel):
    delta_id: str = Field(..., description="ID of the delta to apply")
    run_ids: List[str] = Field(..., description="List of Run IDs to patch and execute")
    batch_size: Optional[int] = Field(1, description="Number of times to run each patched run to collect average results")