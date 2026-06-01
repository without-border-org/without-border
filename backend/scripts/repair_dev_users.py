"""Repair seeded users corrupted by the AUTH_DISABLED WebSocket upsert bug.

Before the fix in messages_router.websocket_chat, every WebSocket connection in
AUTH_DISABLED mode ran upsert_from_token() with stub claims (no locale,
email="bypass@test.local"). That silently reset each seeded user's
preferred_language to "fr" and overwrote their email — breaking the whole
multilingual translation demo (everyone ended up "speaking" French).

This script restores the canonical profile fields (email, username,
preferred_language, status, agentic flags) for every demo user by UUID, then
clears the translation cache so it regenerates against the corrected languages.

Run from the backend directory:
    python -m scripts.repair_dev_users
"""
import asyncio
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import select, func, text

from app.core.database import AsyncSessionLocal
from app.models.models import User, MessageTranslation
from app.seed import DEMO_USERS


async def main() -> None:
    async with AsyncSessionLocal() as db:
        repaired = 0
        for u in DEMO_USERS:
            r = await db.execute(select(User).where(User.id == u["id"]))
            user = r.scalar_one_or_none()
            if not user:
                print(f"  ! missing user {u['email']} ({u['id']}) — run seed first")
                continue

            before = (user.email, user.preferred_language, user.status)
            user.email = u["email"]
            user.username = u["username"]
            user.preferred_language = u["preferred_language"]
            user.status = u["status"]
            user.agentic_enabled = u.get("agentic_enabled", False)
            user.agentic_persona = u.get("agentic_persona")
            user.is_active = True
            after = (user.email, user.preferred_language, user.status)

            if before != after:
                repaired += 1
                print(f"  ✓ {u['username']:<15} {before} → {after}")

        # The translation cache was built against the wrong target languages while
        # users were stuck on "fr"; drop it so the next GET /messages regenerates it.
        count_r = await db.execute(select(func.count()).select_from(MessageTranslation))
        cache_count = count_r.scalar() or 0
        await db.execute(text("TRUNCATE message_translations"))

        await db.commit()

    print("\nSummary:")
    print(f"  Users repaired      : {repaired}")
    print(f"  Cache rows cleared  : {cache_count}")
    print("\nDone. Reconnect each user — their language now persists.")


if __name__ == "__main__":
    asyncio.run(main())
