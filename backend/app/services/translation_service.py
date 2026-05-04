"""Translation service using Gemma 4 with PostgreSQL cache."""
import hashlib
from sqlalchemy.ext.asyncio import AsyncSession
from app.helpers.llm_provider import LLMProvider, get_llm_provider
from app.helpers.language_detector import detect_language
from app.repositories.repositories import MessageRepository
import uuid

TRANSLATE_SYSTEM = (
    "You are a professional multilingual translator. "
    "Translate the text to {target_language}. "
    "Return ONLY the translated text. No explanation, no preamble, no quotes."
)


class TranslationService:
    """Handles message translation with BDD caching (no Redis)."""

    def __init__(self, llm: LLMProvider = None):
        self.llm = llm or get_llm_provider()

    async def translate(self, text: str, target_language: str, source_language: str = None) -> str:
        """Translates text to target_language. Returns original if same language."""
        if not text.strip():
            return text
        src = source_language or await detect_language(text)
        if src == target_language:
            return text
        system = TRANSLATE_SYSTEM.format(target_language=target_language)
        return await self.llm.complete(system_prompt=system, user_prompt=text)

    async def translate_with_cache(
        self, db: AsyncSession, message_id: uuid.UUID,
        text: str, target_language: str, source_language: str
    ) -> str:
        """Translates with BDD cache. Checks table message_translations first."""
        if source_language == target_language:
            return text

        msg_repo = MessageRepository(db)
        cached = await msg_repo.get_cached_translation(message_id, target_language)
        if cached:
            return cached

        translated = await self.translate(text, target_language, source_language)
        await msg_repo.save_translation(message_id, target_language, translated)
        return translated

    async def translate_for_members(
        self, db: AsyncSession, message_id: uuid.UUID,
        text: str, source_language: str, target_languages: list[str]
    ) -> dict[str, str]:
        """Translates a message for all required languages, with cache."""
        results: dict[str, str] = {source_language: text}
        unique = set(target_languages) - {source_language}
        for lang in unique:
            results[lang] = await self.translate_with_cache(db, message_id, text, lang, source_language)
        return results
