from sqlalchemy import Column, String, Float, Boolean, JSON, DateTime, ForeignKey, Integer
from sqlalchemy.sql import func
from backend.app.core.database import Base

class RunRecord(Base):
    __tablename__ = "runs"
    
    run_id = Column(String, primary_key=True, index=True)
    model_name = Column(String, nullable=False)
    temperature = Column(Float, default=0.0)
    messages = Column(JSON, nullable=False)
    tools = Column(JSON, nullable=False)
    env_vars = Column(JSON, nullable=True)
    max_tokens = Column(Integer, nullable=True)
    thinking_mode = Column(String, nullable=True, default="default")
    thinking_effort = Column(String, nullable=True, default="")
    baseline_output = Column(String, nullable=True)
    baseline_latency_ms = Column(Float, nullable=True)
    baseline_token_usage = Column(JSON, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

class DeltaRecord(Base):
    __tablename__ = "deltas"
    
    delta_id = Column(String, primary_key=True, index=True)
    name = Column(String, nullable=False)
    target_component = Column(String, nullable=False) # e.g., "message", "temperature", "tools"
    target_role = Column(String, nullable=True)       # e.g., "system", "human" (if component is message)
    target_index = Column(Integer, nullable=True)     # e.g., 0 for first occurrence, -1 for last
    operation = Column(String, nullable=False)        # e.g., "replace", "append", "insert_before"
    anchor = Column(String, nullable=True)            # anchor text for strict matching
    value = Column(JSON, nullable=False)              # string, dict, or list
    strict = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class TrialRecord(Base):
    __tablename__ = "trials"
    
    trial_id = Column(String, primary_key=True, index=True)
    run_id = Column(String, ForeignKey("runs.run_id"), nullable=False)
    delta_id = Column(String, ForeignKey("deltas.delta_id"), nullable=False)
    status = Column(String, nullable=False)           # "applied", "skipped", "failed"
    reason = Column(String, nullable=True)
    patched_snapshot = Column(JSON, nullable=True)
    output_snapshot = Column(JSON, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())