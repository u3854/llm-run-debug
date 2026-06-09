import uuid
from typing import List
from backend.app.core.database import SessionLocal
from backend.app.core.domain import TrialRecord
from backend.app.schemas.trials import TrialSchema
from backend.app.schemas.deltas import DeltaCreate
from backend.app.services.langsmith_service import LangSmithService
from backend.app.services.delta_service import DeltaService
from backend.app.services.patch_engine import PatchEngine, PatchError
from backend.app.services.run_runner import RunRunner

class TrialService:
    def __init__(self):
        self.run_service = LangSmithService()
        self.delta_service = DeltaService()
        self.patch_engine = PatchEngine()
        self.run_runner = RunRunner()

    def execute_bulk_trials(self, delta_id: str, run_ids: List[str], batch_size: int = 1) -> List[TrialSchema]:
        db = SessionLocal()
        results = []
        
        try:
            # 1. Fetch the strict Delta payload
            delta_schema = self.delta_service.get_delta(delta_id)
            delta_create = DeltaCreate(**delta_schema.model_dump())

            for run_id in run_ids:
                trial_id = f"trial_{uuid.uuid4().hex[:8]}"
                trial_record = TrialRecord(
                    trial_id=trial_id,
                    run_id=run_id,
                    delta_id=delta_id,
                    status="failed"
                )

                try:
                    # 2. Load the immutable Run Config
                    run_config = self.run_service.load_run_config(run_id)

                    # 3. Strictly Apply the Patch
                    try:
                        patched_run = self.patch_engine.apply(run_config, delta_create)
                        trial_record.patched_snapshot = patched_run.model_dump()
                        
                        # 4. If applied successfully, Recreate and Execute the LLM Call N times
                        executions = []
                        for _ in range(batch_size):
                            exec_out = self.run_runner.recreate_and_execute_run(patched_run)
                            executions.append(exec_out)

                        # Calculate average stats
                        avg_latency = sum(e.latency_ms for e in executions) / len(executions)
                        
                        avg_usage = {}
                        if executions and all(e.usage for e in executions):
                            keys = executions[0].usage.keys()
                            for k in keys:
                                try:
                                    avg_usage[k] = sum(e.usage.get(k, 0) for e in executions) // len(executions)
                                except Exception:
                                    pass

                        trial_record.output_snapshot = {
                            "content": executions[0].content,
                            "tool_calls": executions[0].tool_calls,
                            "latency_ms": avg_latency,
                            "usage": avg_usage,
                            "executions": [e.model_dump() for e in executions]
                        }
                        trial_record.status = "applied"
                        
                    except PatchError as e:
                        # A conflict was detected! Fail gracefully and skip execution.
                        trial_record.status = "skipped"
                        trial_record.reason = str(e)
                        
                except Exception as e:
                    trial_record.status = "failed"
                    trial_record.reason = f"System Error: {str(e)}"

                # Persist the state of the trial
                db.add(trial_record)
                db.commit()
                db.refresh(trial_record)
                results.append(self._map_to_schema(trial_record))
                
        finally:
            db.close()
            
        return results

    def delete_trial(self, trial_id: str) -> None:
        db = SessionLocal()
        try:
            r = db.query(TrialRecord).filter(TrialRecord.trial_id == trial_id).first()
            if not r:
                raise FileNotFoundError(f"Trial {trial_id} not found")
            db.delete(r)
            db.commit()
        finally:
            db.close()

    def clear_trials_for_delta(self, delta_id: str) -> None:
        db = SessionLocal()
        try:
            db.query(TrialRecord).filter(TrialRecord.delta_id == delta_id).delete()
            db.commit()
        finally:
            db.close()

    def list_trials(self) -> List[TrialSchema]:
        db = SessionLocal()
        try:
            records = db.query(TrialRecord).order_by(TrialRecord.created_at.desc()).all()
            return [self._map_to_schema(r) for r in records]
        finally:
            db.close()
            
    def _map_to_schema(self, record: TrialRecord) -> TrialSchema:
        data = {c.name: getattr(record, c.name) for c in record.__table__.columns}
        created_at = record.created_at
        if created_at:
            if isinstance(created_at, str):
                data["created_at"] = created_at
            elif hasattr(created_at, "isoformat"):
                data["created_at"] = created_at.isoformat()
            else:
                data["created_at"] = str(created_at)
        else:
            data["created_at"] = None
        return TrialSchema(**data)