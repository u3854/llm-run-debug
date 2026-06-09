import uuid
from typing import List
from backend.app.core.database import SessionLocal
from backend.app.core.domain import DeltaRecord
from backend.app.schemas.deltas import DeltaCreate, DeltaSchema

class DeltaService:
    def create_delta(self, delta_in: DeltaCreate) -> DeltaSchema:
        db = SessionLocal()
        try:
            delta_id = f"delta_{uuid.uuid4().hex[:8]}"
            db_delta = DeltaRecord(
                delta_id=delta_id,
                name=delta_in.name,
                target_component=delta_in.target_component,
                target_role=delta_in.target_role,
                target_index=delta_in.target_index,
                operation=delta_in.operation,
                anchor=delta_in.anchor,
                value=delta_in.value,
                strict=delta_in.strict
            )
            db.add(db_delta)
            db.commit()
            db.refresh(db_delta)
            return self._map_to_schema(db_delta)
        finally:
            db.close()

    def list_deltas(self) -> List[DeltaSchema]:
        db = SessionLocal()
        try:
            records = db.query(DeltaRecord).order_by(DeltaRecord.created_at.desc()).all()
            return [self._map_to_schema(r) for r in records]
        finally:
            db.close()

    def get_delta(self, delta_id: str) -> DeltaSchema:
        db = SessionLocal()
        try:
            r = db.query(DeltaRecord).filter(DeltaRecord.delta_id == delta_id).first()
            if not r:
                raise FileNotFoundError(f"Delta {delta_id} not found")
            return self._map_to_schema(r)
        finally:
            db.close()

    def delete_delta(self, delta_id: str) -> None:
        db = SessionLocal()
        try:
            r = db.query(DeltaRecord).filter(DeltaRecord.delta_id == delta_id).first()
            if not r:
                raise FileNotFoundError(f"Delta {delta_id} not found")
            
            # Cascade delete trials associated with this delta
            from backend.app.core.domain import TrialRecord
            db.query(TrialRecord).filter(TrialRecord.delta_id == delta_id).delete()
            
            db.delete(r)
            db.commit()
        finally:
            db.close()
            
    def _map_to_schema(self, record: DeltaRecord) -> DeltaSchema:
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
        return DeltaSchema(**data)