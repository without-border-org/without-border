"""LLM Provider — abstract interface + Ollama and Vertex AI implementations."""
from abc import ABC, abstractmethod
from typing import AsyncIterator
import httpx
from app.core.config.settings import settings


class LLMProvider(ABC):
    """Abstract interface for Gemma 4 providers."""

    @abstractmethod
    async def complete(self, system_prompt: str, user_prompt: str) -> str: ...

    @abstractmethod
    async def is_available(self) -> bool: ...


class OllamaProvider(LLMProvider):
    """Gemma 4 via local Ollama."""

    def __init__(self):
        self.base_url = settings.OLLAMA_BASE_URL
        self.model = settings.LLM_MODEL

    async def complete(self, system_prompt: str, user_prompt: str) -> str:
        payload = {
            "model": self.model,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            "stream": False,
            "options": {"temperature": 0.3},
        }
        async with httpx.AsyncClient(timeout=30.0) as client:
            r = await client.post(f"{self.base_url}/api/chat", json=payload)
            r.raise_for_status()
            return r.json()["message"]["content"].strip()

    async def is_available(self) -> bool:
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                r = await client.get(f"{self.base_url}/api/tags")
                return r.status_code == 200
        except Exception:
            return False


class VertexAIProvider(LLMProvider):
    """Gemma 4 via Google Vertex AI Model Garden."""

    def __init__(self):
        self.project = settings.VERTEXAI_PROJECT
        self.location = settings.VERTEXAI_LOCATION
        self.model = "google/gemma-4-27b-it"

    async def complete(self, system_prompt: str, user_prompt: str) -> str:
        import vertexai  # type: ignore
        from vertexai.generative_models import GenerativeModel  # type: ignore
        vertexai.init(project=self.project, location=self.location)
        model = GenerativeModel(self.model, system_instruction=system_prompt)
        response = model.generate_content(user_prompt)
        return response.text.strip()

    async def is_available(self) -> bool:
        return bool(self.project)


def get_llm_provider() -> LLMProvider:
    """Factory — returns configured LLM provider."""
    providers = {"ollama": OllamaProvider, "vertexai": VertexAIProvider}
    cls = providers.get(settings.LLM_PROVIDER, OllamaProvider)
    return cls()
