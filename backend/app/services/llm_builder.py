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

def build_single_llm(model: str, temperature: float = 0.0, max_tokens: Optional[int] = None) -> BaseChatModel:
    """Build a single Langchain Chat instance based on the model name."""
    provider = get_provider_for_model(model)
    
    if provider == "openai":
        try:
            from langchain_openai import ChatOpenAI
        except ImportError:
            raise ImportError(
                "langchain-openai is not installed. Please install it to use OpenAI models."
            )
        return ChatOpenAI(
            model=model,
            temperature=temperature,
            max_tokens=max_tokens,
            api_key=settings.OPENAI_API_KEY,
        )
    elif provider == "anthropic":
        try:
            from langchain_anthropic import ChatAnthropic
        except ImportError:
            raise ImportError(
                "langchain-anthropic is not installed. Please install it to use Anthropic models."
            )
        return ChatAnthropic(
            model=model,
            temperature=temperature,
            max_tokens=max_tokens,
            api_key=settings.ANTHROPIC_API_KEY,
        )
    elif provider == "nvidia":
        try:
            from langchain_nvidia_ai_endpoints import ChatNVIDIA
        except ImportError:
            raise ImportError(
                "langchain-nvidia-ai-endpoints is not installed. Please install it to use NVIDIA models."
            )
        return ChatNVIDIA(
            model=model,
            temperature=temperature,
            max_completion_tokens=max_tokens,
            api_key=settings.NVIDIA_API_KEY,
        )
    elif provider == "gemini":
        try:
            from langchain_google_genai import ChatGoogleGenerativeAI
        except ImportError:
            raise ImportError(
                "langchain-google-genai is not installed. Please install it to use Gemini models."
            )
        # Use GEMINI_API_KEY or fallback to GOOGLE_API_KEY
        api_key = settings.GEMINI_API_KEY or settings.GOOGLE_API_KEY
        return ChatGoogleGenerativeAI(
            model=model,
            temperature=temperature,
            max_output_tokens=max_tokens,
            api_key=api_key,
        )
    elif provider == "ollama":
        try:
            from langchain_ollama import ChatOllama
        except ImportError:
            raise ImportError(
                "langchain-ollama is not installed. Please install it to use Ollama models."
            )
        clean_model = model.split("/")[-1] if "/" in model else model
        return ChatOllama(
            model=clean_model,
            temperature=temperature,
            num_predict=max_tokens,
            base_url=settings.OLLAMA_BASE_URL,
            client_kwargs={
                "headers": {"Authorization": f"Bearer {settings.OLLAMA_API_KEY}"}
            } if settings.OLLAMA_API_KEY else None,
        )
    else:
        raise ValueError(f"Unsupported provider for model: {model}")
