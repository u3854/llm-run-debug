from pydantic import BaseModel, Field
from typing import Optional, Any

class DeltaCreate(BaseModel):
    name: str = Field(..., description="Human readable name for the delta")
    target_component: str = Field(..., description="Target: 'message', 'model_name', 'temperature', 'tools'")
    target_role: Optional[str] = Field(None, description="If targeting message, the role (e.g., 'system', 'human')")
    target_index: Optional[int] = Field(None, description="If targeting message, 0-based index or -1 for last")
    operation: str = Field(..., description="'replace', 'append', 'prepend', 'insert_before', 'insert_after'")
    anchor: Optional[str] = Field(None, description="Text anchor for strict matching")
    value: Any = Field(..., description="Value to insert or replace with (string, dict, or list)")
    strict: bool = Field(True, description="Whether to fail on ambiguity or missing anchor")

class DeltaSchema(DeltaCreate):
    delta_id: str
    created_at: Optional[str] = None