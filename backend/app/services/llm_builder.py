import logging
from typing import Optional, Literal
from langchain_core.language_models import BaseChatModel
from backend.app.core.config import settings

logger = logging.getLogger(__name__)

ProviderType = Literal["openai", "anthropic", "gemini", "ollama", "nvidia"]

_OLLAMA_PREFIXES = [
    "llama",
    "mistral",
    "gemma",
    "phi",
    "qwen",
    "deepseek",
    "codellama",
    "codegemma",
]

def get_provider_for_model(model_name: str) -> ProviderType:
    """
    Detect provider based on model name prefix.
    - gpt- or o1- -> openai
    - claude- -> anthropic
    - gemini- -> gemini
    - llama*, mistral*, deepseek*, etc. or ends with -cloud -> ollama
    - contains / -> nvidia
    """
    m = model_name.lower()
    if "/" in m:
        return "nvidia"
    if m.startswith("gpt-") or m.startswith("o1-") or m.startswith("text-embedding-3"):
        return "openai"
    if m.startswith("claude-"):
        return "anthropic"
    if m.startswith("gemini-") and not m.endswith("cloud"):
        return "gemini"
    if m.endswith("-cloud") or any(m.startswith(prefix) for prefix in _OLLAMA_PREFIXES):
        return "ollama"

    # Default to openai if unknown
    logger.warning(f"Unknown model prefix for '{model_name}', defaulting to openai")
    return "openai"

def build_single_llm(
    model: str,
    temperature: Optional[float] = None,
    max_tokens: Optional[int] = None,
    thinking_mode: Optional[str] = "default",
    thinking_effort: Optional[str] = ""
) -> BaseChatModel:
    """Build a single Langchain Chat instance based on the model name."""
    provider = get_provider_for_model(model)
    
    if provider == "openai":
        try:
            from langchain_openai import ChatOpenAI
        except ImportError:
            raise ImportError(
                "langchain-openai is not installed. Please install it to use OpenAI models."
            )
        kwargs = {
            "model": model,
            "max_tokens": max_tokens,
            "api_key": settings.OPENAI_API_KEY,
        }
        if temperature is not None:
            kwargs["temperature"] = temperature
            
        # Handle OpenAI reasoning effort
        if thinking_effort and thinking_effort.lower() in ("low", "medium", "high"):
            kwargs["reasoning_effort"] = thinking_effort.lower()
            
        return ChatOpenAI(**kwargs)
    elif provider == "anthropic":
        try:
            from langchain_anthropic import ChatAnthropic
        except ImportError:
            raise ImportError(
                "langchain-anthropic is not installed. Please install it to use Anthropic models."
            )
        kwargs = {
            "model": model,
            "max_tokens": max_tokens,
            "api_key": settings.ANTHROPIC_API_KEY,
        }
        if temperature is not None:
            kwargs["temperature"] = temperature
            
        # Parse Anthropic thinking mode
        mode = (thinking_mode or "default").lower()
        effort = (thinking_effort or "").strip()
        
        # If user checked 'Omit Temp' but kept thinking_mode as 'default',
        # we default it to 'adaptive' with 'medium' effort.
        if temperature is None and mode == "default":
            mode = "adaptive"
            if not effort:
                effort = "medium"
            if not kwargs["max_tokens"]:
                kwargs["max_tokens"] = 32000

        # Configure ChatAnthropic args
        if mode == "adaptive":
            kwargs["thinking"] = {"type": "adaptive", "display": "omitted"}
            if effort:
                kwargs["effort"] = effort
        elif mode == "enabled":
            kwargs["thinking"] = {"type": "enabled"}
            if effort:
                if effort.isdigit():
                    kwargs["thinking"]["budget_tokens"] = int(effort)
                else:
                    kwargs["effort"] = effort
        elif mode == "disabled":
            kwargs["thinking"] = {"type": "disabled"}
            
        return ChatAnthropic(**kwargs)
    elif provider == "nvidia":
        try:
            from langchain_nvidia_ai_endpoints import ChatNVIDIA
        except ImportError:
            raise ImportError(
                "langchain-nvidia-ai-endpoints is not installed. Please install it to use NVIDIA models."
            )
        kwargs = {
            "model": model,
            "max_completion_tokens": max_tokens,
            "api_key": settings.NVIDIA_API_KEY,
        }
        if temperature is not None:
            kwargs["temperature"] = temperature
        return ChatNVIDIA(**kwargs)
    elif provider == "gemini":
        try:
            from langchain_google_genai import ChatGoogleGenerativeAI
        except ImportError:
            raise ImportError(
                "langchain-google-genai is not installed. Please install it to use Gemini models."
            )
        # Use GEMINI_API_KEY or fallback to GOOGLE_API_KEY
        api_key = settings.GEMINI_API_KEY or settings.GOOGLE_API_KEY
        kwargs = {
            "model": model,
            "max_output_tokens": max_tokens,
            "api_key": api_key,
        }
        if temperature is not None:
            kwargs["temperature"] = temperature
        return ChatGoogleGenerativeAI(**kwargs)
    elif provider == "ollama":
        try:
            from langchain_ollama import ChatOllama
        except ImportError:
            raise ImportError(
                "langchain-ollama is not installed. Please install it to use Ollama models."
            )
        clean_model = model.split("/")[-1] if "/" in model else model
        kwargs = {
            "model": clean_model,
            "num_predict": max_tokens,
            "base_url": settings.OLLAMA_BASE_URL,
            "client_kwargs": {
                "headers": {"Authorization": f"Bearer {settings.OLLAMA_API_KEY}"}
            } if settings.OLLAMA_API_KEY else None,
        }
        if temperature is not None:
            kwargs["temperature"] = temperature
        return ChatOllama(**kwargs)
    else:
        raise ValueError(f"Unsupported provider for model: {model}")
