from pathlib import Path
from dotenv import load_dotenv

# Load env variables from root directory .env if present
load_dotenv()

class Settings:
    # Resolves to the root of the project: backend/app/core/config.py -> backend/app/core -> backend/app -> backend -> root
    PROJECT_ROOT: Path = Path(__file__).resolve().parent.parent.parent.parent
    RUNS_DIR: Path = PROJECT_ROOT / "data" / "runs"
    
settings = Settings()
