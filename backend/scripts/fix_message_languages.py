"""Re-detect original_language for all messages and clear the translation cache.

Run from the backend directory:
    python -m scripts.fix_message_languages

After running this script, the next GET /messages request for each channel will
queue background translations using the corrected source languages.
"""
import asyncio
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from langdetect import detect_langs, LangDetectException, DetectorFactory
DetectorFactory.seed = 0

from sqlalchemy import select, update, func, text
from app.core.database import AsyncSessionLocal
from app.models.models import Message, MessageTranslation

_MIN_CONFIDENCE = 0.80
_MIN_LENGTH = 15


def _detect(content: str) -> str | None:
    stripped = content.strip()
    if not stripped or len(stripped) < _MIN_LENGTH:
        return None
    try:
        results = detect_langs(stripped)
        if results and results[0].prob >= _MIN_CONFIDENCE:
            return str(results[0].lang)
    except LangDetectException:
        pass
    return None


async def main() -> None:
    async with AsyncSessionLocal() as db:
        r = await db.execute(
            select(Message.id, Message.original_content, Message.original_language)
            .where(Message.deleted_at == None)
        )
        rows = r.all()
        print(f"Loaded {len(rows)} messages")

        updated = 0
        skipped_short = 0
        for row in rows:
            detected = _detect(row.original_content)
            if detected is None:
                skipped_short += 1
                continue
            if detected != row.original_language:
                await db.execute(
                    update(Message)
                    .where(Message.id == row.id)
                    .values(original_language=detected)
                )
                updated += 1
                print(
                    f"  [{row.id}] {row.original_language!r} → {detected!r} | "
                    f"{row.original_content[:60]!r}"
                )

        count_r = await db.execute(select(func.count()).select_from(MessageTranslation))
        cache_count = count_r.scalar() or 0
        await db.execute(text("TRUNCATE message_translations"))

        await db.commit()

    print(f"\nSummary:")
    print(f"  Messages processed : {len(rows)}")
    print(f"  Language corrected : {updated}")
    print(f"  Too short to detect: {skipped_short}")
    print(f"  Cache rows cleared : {cache_count}")
    print("\nDone. Translations will be regenerated on the next GET /messages call.")


if __name__ == "__main__":
    asyncio.run(main())
