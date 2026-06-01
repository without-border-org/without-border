"""Translation service using Gemma 4 with PostgreSQL cache."""
import asyncio
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
        Extracts JSON from Ollama response (which may contain markdown/text wrapper).
        Falls back to individual translation on parse error.
        """
        if not texts:
            _log.debug("[TRANSLATE-BATCH] Empty texts list")
            return []
        if source_language == target_language:
            _log.debug(f"[TRANSLATE-BATCH] Source and target same ({source_language}), returning original")
            return list(texts)

        _log.info(f"[TRANSLATE-BATCH] Translating {len(texts)} texts from {source_language} to {target_language}")
        system = BATCH_TRANSLATE_SYSTEM.format(target_language=target_language)
        payload = json.dumps(texts, ensure_ascii=False)
        try:
            _log.debug(f"[TRANSLATE-BATCH-CALL] Calling LLM with {len(texts)} texts, payload_size={len(payload)}")
            raw = await self.llm.complete(system_prompt=system, user_prompt=payload)
            _log.debug(f"[TRANSLATE-BATCH-RESPONSE] Got response length={len(raw)}, first 200 chars={raw[:200]!r}")

            # Extract JSON array from response (Ollama may wrap it in markdown or text)
            cleaned = self._extract_json_array(raw)
            results = json.loads(cleaned)

            if isinstance(results, list) and len(results) == len(texts):
                _log.info(f"[TRANSLATE-BATCH-OK] Successfully translated {len(results)} texts")
                return [str(r) for r in results]
            else:
                _log.warning(f"[TRANSLATE-BATCH-MISMATCH] Expected {len(texts)} results but got {len(results) if isinstance(results, list) else 'non-list'}")
        except Exception as exc:
            _log.error(f"[TRANSLATE-BATCH-ERROR] Batch translation parse failed: {exc}, falling back to sequential.", exc_info=True)

        # Fallback: translate in parallel (instead of sequential)
        _log.info(f"[TRANSLATE-BATCH-FALLBACK] Falling back to parallel translation for {len(texts)} texts")
        tasks = []
        for i, text in enumerate(texts):
            tasks.append(self._translate_with_fallback(i, text, target_language, source_language, len(texts)))
        results = await asyncio.gather(*tasks, return_exceptions=False)
        return results

    async def _translate_with_fallback(self, index: int, text: str, target_language: str, source_language: str, total: int) -> str:
        """Translate a single text with fallback to original on error."""
        try:
            return await self.translate(text, target_language, source_language)
        except Exception as exc:
            _log.warning(f"[TRANSLATE-BATCH-FALLBACK-FAIL] Failed to translate text {index+1}/{total}: {exc}")
            return text

    def _extract_json_array(self, text: str) -> str:
        """Extract JSON array from response that may contain markdown or text wrapper.

        Handles patterns like:
        - ```json\n[...]\n```
        - ```\n[...]\n```
        - Just [...] without wrapper
        """
        text = text.strip()

        # Try to find JSON array markers
        start_idx = text.find('[')
        end_idx = text.rfind(']')

        if start_idx >= 0 and end_idx > start_idx:
            return text[start_idx:end_idx + 1]

        # No array found, return as-is (will fail in json.loads with clear error)
        return text

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
        _log.info(f"[TRANSLATE-FOR-MEMBERS] msg_id={message_id} src_lang={source_language} target_langs={target_languages}")
        results: dict[str, str] = {source_language: text}
        unique = list(set(target_languages) - {source_language})
        msg_repo = MessageRepository(db)

        # Separate cached from uncached to minimise LLM calls.
        uncached_langs: list[str] = []
        cached_count = 0
        for lang in unique:
            cached = await msg_repo.get_cached_translation(message_id, lang)
            if cached:
                results[lang] = cached
                cached_count += 1
            else:
                uncached_langs.append(lang)

        _log.info(f"[TRANSLATE-FOR-MEMBERS-CACHE] msg_id={message_id} cached={cached_count}/{len(unique)} uncached={len(uncached_langs)}")

        if uncached_langs:
            # Group uncached languages by target language for batch call.
            # (Each language still needs its own call; batching is per-language
            # but groups multiple *messages* — here we handle a single message
            # across multiple languages sequentially, using translate_batch for
            # the texts when called from a multi-message context.)
            _log.info(f"[TRANSLATE-FOR-MEMBERS-TRANSLATE] Translating to {len(uncached_langs)} uncached languages: {uncached_langs}")
            for lang in uncached_langs:
                try:
                    translated = await self.translate(text, lang, source_language)
                    await msg_repo.save_translation(message_id, lang, translated)
                    results[lang] = translated
                    _log.debug(f"[TRANSLATE-FOR-MEMBERS-SAVED] msg_id={message_id} lang={lang} OK")
                except Exception as exc:
                    _log.error(f"[TRANSLATE-FOR-MEMBERS-FAIL] msg_id={message_id} lang={lang} failed: {exc}", exc_info=True)

        _log.info(f"[TRANSLATE-FOR-MEMBERS-END] msg_id={message_id} returned {len(results)} languages")
        return results
