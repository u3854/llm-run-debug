from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from backend.app.api.router import api_router
from backend.app.core.config import settings

app = FastAPI(
    title="LLM Run Debugger & Playground",
    description="Backend API for fetching, modifying, and testing LangSmith LLM runs.",
    version="1.0.0"
)

# Enable CORS for development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register API Router
app.include_router(api_router, prefix="/api")

# Mount the frontend directory if it exists
frontend_dir = settings.PROJECT_ROOT / "frontend"
if not frontend_dir.exists():
    frontend_dir.mkdir(parents=True, exist_ok=True)

app.mount("/", StaticFiles(directory=str(frontend_dir), html=True), name="frontend")
