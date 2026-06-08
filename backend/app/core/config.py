from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    # Resolves to the root of the project: backend/app/core/config.py -> backend/app/core -> backend/app -> backend -> root
    PROJECT_ROOT: Path = Path(__file__).resolve().parent.parent.parent.parent
    RUNS_DIR: Path = PROJECT_ROOT / "data" / "runs"
    
    OPENAI_API_KEY: str | None = None
    ANTHROPIC_API_KEY: str | None = None
    NVIDIA_API_KEY: str | None = None
    GEMINI_API_KEY: str | None = None
    GOOGLE_API_KEY: str | None = None
    OLLAMA_BASE_URL: str = "https://ollama.com"
    OLLAMA_API_KEY: str | None = None

    model_config = SettingsConfigDict(
        env_file=PROJECT_ROOT / ".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

settings = Settings()
