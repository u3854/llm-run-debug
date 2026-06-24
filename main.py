import uvicorn
from dotenv import load_dotenv

load_dotenv()

if __name__ == "__main__":
    # Launch uvicorn server directly when running 'python main.py' or 'uv run main.py'
    uvicorn.run("backend.app.main:app", host="127.0.0.1", port=8010, reload=True)