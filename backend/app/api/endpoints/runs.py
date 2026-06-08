from fastapi import APIRouter, HTTPException
from backend.app.schemas import FetchRequest, RunConfig, TestRunResponse
from backend.app.services.langsmith_service import LangSmithService
from backend.app.services.run_runner import RunRunner

router = APIRouter()

langsmith_service = LangSmithService()
run_runner = RunRunner()

@router.post("/fetch", response_model=RunConfig)
async def fetch_run(req: FetchRequest):
    """
    Downloads a run from LangSmith by ID, stores its serialized configuration 
    locally in a JSON file, and returns the parsed config.
    """
    try:
        config = langsmith_service.fetch_and_save_run(req.run_id)
        return config
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Unexpected error: {str(e)}")

@router.get("")
async def list_runs():
    """
    Lists all runs that have been fetched and saved locally.
    """
    try:
        return langsmith_service.list_saved_runs()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{run_id}", response_model=RunConfig)
async def get_run(run_id: str):
    """
    Retrieves the local configuration JSON for a specific run ID.
    """
    try:
        return langsmith_service.load_run_config(run_id)
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/test", response_model=TestRunResponse)
async def test_run(config: RunConfig):
    """
    Accepts an LLM run configuration (model, temperature, messages, and tools),
    recreates the LLM call, executes it, and returns the output content and performance metrics.
    """
    try:
        response = run_runner.recreate_and_execute_run(config)
        return response
    except (ValueError, ImportError) as e:
        raise HTTPException(status_code=400, detail=str(e))
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Execution error: {str(e)}")
