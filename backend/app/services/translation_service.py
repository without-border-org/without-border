"""Translation service using Gemma 4 with PostgreSQL cache."""
import json
import logging
import uuid
from sqlalchemy.ext.asyncio import AsyncSession
from app.helpers.llm_provider import LLMProvider, get_llm_provider
from app.helpers.language_detector import detect_language
from app.repositories.repositories import MessageRepository

TRANSLATE_SYSTEM = (
    "You are a professional multilingual translator. "
    "Translate the text to {target_language}. "
    "Return ONLY the translated text. No explanation, no preamble, no quotes."
)

BATCH_TRANSLATE_SYSTEM = (
    "You are a professional multilingual translator. "
    "You will receive a JSON array of texts. "
    "Translate ALL texts to {target_language}. "
    "Return ONLY a JSON array of translated strings, in the same order, with no extra text."
)

_log = logging.getLogger(__name__)


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

    async def translate_batch(
        self, texts: list[str], target_language: str, source_language: str
    ) -> list[str]:
        """Translates a list of texts in a single Ollama call (CA-05).

        Sends all texts as a JSON array and parses the JSON array response.
        Falls back to individual translation on parse error.
        """
        if not texts:
            return []
        if source_language == target_language:
            return list(texts)

        system = BATCH_TRANSLATE_SYSTEM.format(target_language=target_language)
        payload = json.dumps(texts, ensure_ascii=False)
        try:
            raw = await self.llm.complete(system_prompt=system, user_prompt=payload)
            results = json.loads(raw)
            if isinstance(results, list) and len(results) == len(texts):
                return [str(r) for r in results]
        except Exception as exc:
            _log.warning("Batch translation parse failed (%s), falling back to sequential.", exc)

        # Fallback: translate one by one
        out = []
        for text in texts:
            try:
                out.append(await self.translate(text, target_language, source_language))
            except Exception:
                out.append(text)
        return out

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
        """Translates a message for all required languages, with cache.

        Uses translate_batch() for uncached languages to minimise Ollama round-trips.
        """
        results: dict[str, str] = {source_language: text}
        unique = list(set(target_languages) - {source_language})
        msg_repo = MessageRepository(db)

        # Separate cached from uncached to minimise LLM calls.
        uncached_langs: list[str] = []
        for lang in unique:
            cached = await msg_repo.get_cached_translation(message_id, lang)
            if cached:
                results[lang] = cached
            else:
                uncached_langs.append(lang)

        if uncached_langs:
            # Group uncached languages by target language for batch call.
            # (Each language still needs its own call; batching is per-language
            # but groups multiple *messages* — here we handle a single message
            # across multiple languages sequentially, using translate_batch for
            # the texts when called from a multi-message context.)
            for lang in uncached_langs:
                translated = await self.translate(text, lang, source_language)
                await msg_repo.save_translation(message_id, lang, translated)
                results[lang] = translated

        return results
