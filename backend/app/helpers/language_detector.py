"""Language detection using langdetect with fallback."""
from langdetect import detect, LangDetectException


async def detect_language(text: str) -> str:
    """Returns ISO 639-1 language code. Defaults to 'en' on failure."""
    if not text or len(text.strip()) < 3:
        return "en"
    try:
        return detect(text)
    except LangDetectException:
        return "en"
