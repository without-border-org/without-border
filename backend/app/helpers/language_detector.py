"""Language detection using langdetect with confidence gating."""
from langdetect import detect_langs, LangDetectException, DetectorFactory

# Seed for reproducibility — langdetect is non-deterministic by default.
DetectorFactory.seed = 0

_MIN_CONFIDENCE = 0.80
# Chat messages are short by nature ("ok", "merci", "thanks"). A high minimum
# length forced every short message to the fallback language, breaking the whole
# translation pipeline. Keep a tiny floor only to skip emoji-only / 1-char noise.
_MIN_LENGTH = 3
_DEFAULT_LANG = "fr"


async def detect_language(text: str, default: str | None = None) -> str:
    """Returns ISO 639-1 language code.

    Only trusts the detection when confidence ≥ 80 % and text is long enough.
    When detection is uncertain (too short, low confidence, or failure) it falls
    back to ``default`` — typically the sender's preferred language, which is a far
    stronger prior than a hard-coded constant — to avoid poisoning the translation
    cache with a wrong source language.
    """
    fallback = default or _DEFAULT_LANG
    stripped = text.strip()
    if not stripped or len(stripped) < _MIN_LENGTH:
        return fallback
    try:
        results = detect_langs(stripped)
        if results and results[0].prob >= _MIN_CONFIDENCE:
            return str(results[0].lang)
    except LangDetectException:
        pass
    return fallback
