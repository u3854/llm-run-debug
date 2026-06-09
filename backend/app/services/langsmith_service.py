import json
from typing import List, Dict, Any
from langsmith import Client
from langchain_core.load import load
from langchain_core.messages import SystemMessage, HumanMessage, AIMessage, ToolMessage, ChatMessage
from backend.app.schemas.runs import RunConfig, MessageSchema
from backend.app.core.config import settings
from backend.app.core.database import SessionLocal, engine
from backend.app.core.domain import Base, RunRecord

# Ensure tables are created on boot
Base.metadata.create_all(bind=engine)

class LangSmithService:
    def __init__(self):
        # LangSmith Client will automatically pick up LANGCHAIN_API_KEY from environment
        self._client = None
        self.runs_dir = settings.RUNS_DIR
        self.runs_dir.mkdir(parents=True, exist_ok=True)

    @property
    def client(self) -> Client:
        if self._client is None:
            self._client = Client()
        return self._client

    def fetch_and_save_run(self, run_id: str) -> RunConfig:
        """
        Fetches a run from LangSmith by ID, parses its LLM config,
        messages, and tools, saves it to a local JSON file, and returns it.
        """
        try:
            run = self.client.read_run(run_id)
        except Exception as e:
            raise ValueError(f"Failed to fetch run '{run_id}' from LangSmith: {str(e)}")

        # 1. Parse invocation parameters (model name, temperature, tools)
        inv_params = run.extra.get('invocation_params', {}) if run.extra else {}
        model_name = inv_params.get('model', inv_params.get('model_name', 'gpt-4o-mini'))
        temperature = inv_params.get('temperature', 0.0)
        
        # We can extract tools from invocation parameters or inputs
        tools = inv_params.get('tools', [])
        if not tools and run.inputs:
            tools = run.inputs.get('tools', [])

        # 2. Extract and deserialize messages
        messages: List[MessageSchema] = []
        if run.inputs:
            # Try to grab serialized messages from inputs
            raw_messages = run.inputs.get('messages')
            
            # Replicate main.py behavior: raw_messages can be nested as [ [ {msg1}, {msg2} ] ]
            if isinstance(raw_messages, list) and len(raw_messages) > 0:
                if isinstance(raw_messages[0], list):
                    serialized_messages = raw_messages[0]
                else:
                    serialized_messages = raw_messages
            else:
                serialized_messages = []

            for msg_data in serialized_messages:
                try:
                    # Deserialize with LangChain loader if it has constructor fields
                    if isinstance(msg_data, dict) and ("lc" in msg_data or "type" in msg_data):
                        lc_msg = load(msg_data)
                        messages.append(self._map_langchain_to_schema(lc_msg))
                    else:
                        # Fallback for plain dictionary or already parsed shapes
                        messages.append(self._map_dict_to_schema(msg_data))
                except Exception as _ex:
                    # If loading fails, keep a fallback representation
                    messages.append(MessageSchema(
                        role="user",
                        content=str(msg_data)
                    ))

        # 3. Create RunConfig object
        config = RunConfig(
            run_id=run_id,
            model_name=model_name,
            temperature=float(temperature),
            messages=messages,
            tools=tools or []
        )

        # 4. Save to JSON file
        self.save_run_config(run_id, config)
        return config

    def save_run_config(self, run_id: str, config: RunConfig) -> None:
        """Saves a RunConfig object to SQLite DB (and fallback JSON file)."""
        db = SessionLocal()
        try:
            db_run = db.query(RunRecord).filter(RunRecord.run_id == run_id).first()
            if not db_run:
                db_run = RunRecord(run_id=run_id)
                db.add(db_run)
            
            db_run.model_name = config.model_name
            db_run.temperature = config.temperature
            db_run.messages = [msg.model_dump() for msg in config.messages]
            db_run.tools = config.tools
            db_run.env_vars = config.env_vars
            db.commit()
        finally:
            db.close()
            
        # Keep writing to JSON temporarily as a backup/migration safety net
        file_path = self.runs_dir / f"{run_id}.json"
        with open(file_path, "w", encoding="utf-8") as f:
            json.dump(config.model_dump(), f, indent=2, ensure_ascii=False)

    def load_run_config(self, run_id: str) -> RunConfig:
        """Loads a RunConfig object from DB (falling back to JSON if needed)."""
        db = SessionLocal()
        try:
            db_run = db.query(RunRecord).filter(RunRecord.run_id == run_id).first()
            if db_run:
                return RunConfig(
                    run_id=db_run.run_id,
                    model_name=db_run.model_name,
                    temperature=db_run.temperature,
                    messages=db_run.messages,
                    tools=db_run.tools,
                    env_vars=db_run.env_vars
                )
            
            # Migration fallback: read JSON and save to DB
            file_path = self.runs_dir / f"{run_id}.json"
            if file_path.exists():
                with open(file_path, "r", encoding="utf-8") as f:
                    data = json.load(f)
                config = RunConfig(**data)
                self.save_run_config(run_id, config)
                return config
                
            raise FileNotFoundError(f"Run config '{run_id}' does not exist.")
        finally:
            db.close()

    def delete_run_config(self, run_id: str) -> None:
        """Deletes a saved RunConfig from DB and JSON by ID."""
        db = SessionLocal()
        try:
            db_run = db.query(RunRecord).filter(RunRecord.run_id == run_id).first()
            if db_run:
                db.delete(db_run)
                db.commit()
        finally:
            db.close()
            
        file_path = self.runs_dir / f"{run_id}.json"
        if file_path.exists():
            file_path.unlink()

    def list_saved_runs(self) -> List[Dict[str, Any]]:
        """Lists metadata of all saved runs from the Database, ensuring JSONs are migrated."""
        # Pre-migrate missing JSON files to SQLite gracefully
        if self.runs_dir.exists():
            for file in self.runs_dir.glob("*.json"):
                try:
                    self.load_run_config(file.stem) # calling load automatically saves to DB if missing
                except Exception:
                    continue
        
        db = SessionLocal()
        try:
            runs = db.query(RunRecord).order_by(RunRecord.created_at.desc()).all()
            return [
                {
                    "run_id": r.run_id,
                    "model_name": r.model_name,
                    "message_count": len(r.messages) if r.messages else 0,
                    "tool_count": len(r.tools) if r.tools else 0,
                    "temperature": r.temperature,
                    "last_modified": r.updated_at.timestamp() if r.updated_at else r.created_at.timestamp()
                }
                for r in runs
            ]
        finally:
            db.close()

    def _map_langchain_to_schema(self, msg) -> MessageSchema:
        """Converts a deserialized LangChain message object into MessageSchema."""
        role = "user"
        if isinstance(msg, SystemMessage):
            role = "system"
        elif isinstance(msg, AIMessage):
            role = "ai"
        elif isinstance(msg, ToolMessage):
            role = "tool"
        elif isinstance(msg, HumanMessage):
            role = "human"
        elif isinstance(msg, ChatMessage):
            role = msg.role

        tool_calls = getattr(msg, "tool_calls", None)
        # Ensure tool_calls is a list of dictionary elements if populated
        if tool_calls and not isinstance(tool_calls, list):
            tool_calls = [tool_calls]

        return MessageSchema(
            role=role,
            content=msg.content,
            name=getattr(msg, "name", None),
            tool_calls=tool_calls,
            tool_call_id=getattr(msg, "tool_call_id", None) if role == "tool" else None
        )

    def _map_dict_to_schema(self, msg_data: Any) -> MessageSchema:
        """Converts a standard dictionary representation of a message into MessageSchema."""
        if not isinstance(msg_data, dict):
            return MessageSchema(role="user", content=str(msg_data))

        # Check for OpenAI format or direct fields
        role = msg_data.get("role", msg_data.get("type", "user"))
        content = msg_data.get("content", "")
        name = msg_data.get("name")
        tool_calls = msg_data.get("tool_calls")
        tool_call_id = msg_data.get("tool_call_id")

        # Normalize roles
        if role in ["assistant", "ai"]:
            role = "ai"
        elif role in ["user", "human"]:
            role = "human"

        return MessageSchema(
            role=role,
            content=content,
            name=name,
            tool_calls=tool_calls,
            tool_call_id=tool_call_id
        )
