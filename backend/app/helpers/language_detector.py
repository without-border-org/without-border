"""Language detection using langdetect with confidence gating."""
from langdetect import detect_langs, LangDetectException, DetectorFactory

# Seed for reproducibility — langdetect is non-deterministic by default.
DetectorFactory.seed = 0

_MIN_CONFIDENCE = 0.80
_MIN_LENGTH = 15
_DEFAULT_LANG = "fr"


async def detect_language(text: str) -> str:
    """Returns ISO 639-1 language code.

    Only trusts the detection when confidence ≥ 80 % and text is long enough.
    Falls back to _DEFAULT_LANG to avoid poisoning the translation cache with
    a wrong source language.
    """
    stripped = text.strip()
    if not stripped or len(stripped) < _MIN_LENGTH:
        return _DEFAULT_LANG
    try:
        results = detect_langs(stripped)
        if results and results[0].prob >= _MIN_CONFIDENCE:
            return str(results[0].lang)
    except LangDetectException:
        pass
    return _DEFAULT_LANG
