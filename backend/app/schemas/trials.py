from pydantic import BaseModel, Field
from typing import Optional, Any, Dict

class TrialSchema(BaseModel):
    trial_id: str
    run_id: str
    delta_id: str
    status: str = Field(..., description="'applied', 'skipped', 'failed'")
    reason: Optional[str] = None
    patched_snapshot: Optional[Dict[str, Any]] = None
    output_snapshot: Optional[Dict[str, Any]] = None
    created_at: Optional[str] = None