# LLM Run Debugger & Playground

A developer tool designed to download runs from LangSmith, store them in a clean JSON format, and recreate/modify/replay the runs in a visual playground.

## Project Structure

```
llm-run-debug/
├── data/
│   └── runs/                     # JSON serialized runs from LangSmith
├── backend/
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py               # FastAPI application and entrypoint
│   │   ├── core/
│   │   │   ├── __init__.py
│   │   │   └── config.py         # Configuration settings & paths
│   │   ├── api/
│   │   │   ├── __init__.py
│   │   │   ├── router.py         # App base API router
│   │   │   └── endpoints/
│   │   │       ├── __init__.py
│   │   │       └── runs.py       # Endpoints for runs fetch & test
│   │   ├── schemas/
│   │   │   ├── __init__.py
│   │   │   └── runs.py           # Pydantic data schemas
│   │   └── services/
│   │       ├── __init__.py
│   │       ├── langsmith_service.py # Interacts with LangSmith API
│   │       └── run_runner.py     # Recreates LLM calls & binds tools
├── frontend/                     # Dashboard Single-Page App (SPA)
│   ├── index.html                # UI layout and containers
│   ├── css/
│   │   └── styles.css            # Custom properties, dark theme styling
│   └── js/
│       └── app.js                # State management and API integrations
├── main.py                       # CLI Wrapper
├── pyproject.toml                # Dependencies configuration
└── README.md                     # Documentation
```

## Setup Instructions

### 1. Prerequisites
Ensure you have `uv` installed, or use standard `pip` with `virtualenv`.

### 2. Environment Configuration
Create a `.env` file in the root directory and add your API keys:
```env
LANGCHAIN_API_KEY=your_langsmith_api_key
OPENAI_API_KEY=your_openai_api_key
# Optional: LANGCHAIN_TRACING_V2=true
```

### 3. Install Dependencies
Run the following command to sync dependencies:
```bash
uv sync
```
Or with pip:
```bash
pip install -e .
```

### 4. Run the Application
Start the FastAPI server using the root bootstrapper:
```bash
python main.py
```
Or with uv:
```bash
uv run main.py
```
Once running, open your browser and navigate to **[http://localhost:8000](http://localhost:8000)**.

## How It Works

1. **Fetch Run**: Paste a LangSmith Run ID (e.g. `019e9c33-4cb9-7593-b307-686b70da9aca`) in the sidebar. The backend retrieves the run details, extracts the active model, parameters, bound tools, and the message history.
2. **Local Storage**: The parsed configurations are saved under `data/runs/{run_id}.json` in a structured, easily editable format.
3. **Playground Customization**:
   - Change the **Model Name** or **Temperature**.
   - Modify, add, or delete conversational **Messages** (System, Human, AI Assistant, Tool).
   - Change **Bound Tools** definition in the visual JSON Schema editor.
4. **Execution Simulation**: Click **Run Simulation** to dispatch the modified run to the backend. The backend reconstructs the LangChain environment and executes the LLM invocation, displaying response latency, tokens consumed, generated outputs, and tool calls.
