"""Messages endpoints — REST + WebSocket real-time chat."""
import asyncio
import json
import logging
import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, WebSocket, WebSocketDisconnect
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db, AsyncSessionLocal
from app.core.security.jwt_handler import get_current_user, decode_token
from app.core.websocket_manager import connection_manager
from app.repositories.repositories import (
    MessageRepository, ChannelRepository, UserRepository, NotificationRepository
)
from app.schemas.schemas import (
    MessageRead, MessageSend, PaginatedMessages, ReactionAdd, UserRead
)
from app.services.translation_service import TranslationService
from app.agents.agent_service import AgentService
from app.helpers.language_detector import detect_language

router = APIRouter(tags=["messages"])
translation_svc = TranslationService()
agent_svc = AgentService()
_log = logging.getLogger(__name__)

# Safety bound on how many page messages we batch-translate per GET request
# (one Ollama call covers the whole batch, so this only caps the prompt size).
_MAX_BG_TRANSLATIONS = 10000

# Semaphore to cap concurrent Ollama calls from background translation tasks.
_bg_translation_sem = asyncio.Semaphore(5)


async def _cache_translations_batch_bg(
    channel_id: uuid.UUID, user_id: uuid.UUID,
    target_lang: str, items: list[tuple[uuid.UUID, str]],
) -> None:
    """Translate every still-uncached message on a page to ``target_lang`` in a single
    batched Ollama call, cache the results, and push each one to the reader via WS.

    This replaces the previous per-message tasks that were capped at 10 per request —
    on channels with more than 10 untranslated messages the reader was left staring at
    the original language (e.g. an English reader seeing Spanish messages forever).

    DB sessions are kept short: a read-only re-check, then closed before the LLM call,
    then a fresh session to persist — never holding a connection during inference.
    """
    if not items:
        _log.debug("_cache_translations_batch_bg: empty items list, skipping")
        return

    _log.info(f"[BG-TRANSLATE-START] channel={channel_id} user={user_id} target_lang={target_lang} items_count={len(items)}")

    # 1. Re-check cache to skip anything translated since the request was built.
    async with AsyncSessionLocal() as bg_db:
        repo = MessageRepository(bg_db)
        pending: list[tuple[uuid.UUID, str]] = []
        for mid, text in items:
            if not await repo.get_cached_translation(mid, target_lang):
                pending.append((mid, text))

    _log.info(f"[BG-RECHECK-CACHE] After recheck: {len(pending)}/{len(items)} messages still pending for {target_lang}")
    if not pending:
        _log.debug(f"[BG-SKIP] All {len(items)} messages already cached for {target_lang}")
        return

    # 2. Translate the whole batch in one call — rate-limited, no DB connection held.
    _log.info(f"[BG-OLLAMA-CALL] About to translate {len(pending)} messages to {target_lang}")
    try:
        async with _bg_translation_sem:
            translations = await translation_svc.translate_batch(
                [text for _, text in pending],
                target_language=target_lang,
                source_language="",  # mixed/unknown sources — never short-circuits
            )
        _log.info(f"[BG-OLLAMA-OK] Got {len(translations)} translations back")
    except Exception as exc:
        _log.error(
            "[BG-OLLAMA-FAIL] Translation service error for %d msgs to %s: %s",
            len(pending), target_lang, exc, exc_info=True
        )
        return

    if len(translations) != len(pending):
        _log.error(
            "[BG-LENGTH-MISMATCH] Expected %d translations but got %d for lang %s",
            len(pending), len(translations), target_lang
        )
        return

    # 3. Persist results, then notify the reader for each message.
    _log.info(f"[BG-PERSIST-START] Saving {len(translations)} translations to DB for {target_lang}")
    try:
        async with AsyncSessionLocal() as bg_db:
            repo = MessageRepository(bg_db)
            for (mid, _), translated in zip(pending, translations):
                await repo.save_translation(mid, target_lang, translated)
            await bg_db.commit()
        _log.info(f"[BG-PERSIST-OK] Successfully saved {len(translations)} translations for {target_lang}")
    except Exception as exc:
        _log.error(
            "[BG-PERSIST-FAIL] Failed to save translations to DB for %s: %s",
            target_lang, exc, exc_info=True
        )
        return

    # 4. Send notifications via WebSocket
    _log.info(f"[BG-WS-NOTIFY] Sending {len(translations)} messages via WS to user {user_id}")
    for i, ((mid, _), translated) in enumerate(zip(pending, translations)):
        try:
            await connection_manager.send_to_user(channel_id, user_id, {
                "type": "message_translated",
                "data": {"message_id": str(mid), "translated_content": translated},
            })
        except Exception as exc:
            _log.warning(f"[BG-WS-FAIL] Failed to notify message {i+1}/{len(translations)}: {exc}")
    _log.info(f"[BG-TRANSLATE-END] Completed translation batch for {target_lang}")


def _build_message_read(msg, sender, translated: str | None, reactions: list) -> dict:
    return {
        "id": str(msg.id), "channel_id": str(msg.channel_id),
        "sender_id": str(msg.sender_id), "sender_username": sender.username,
        "sender_avatar": sender.avatar_url,
        "original_content": msg.original_content,
        "translated_content": translated,
        "original_language": msg.original_language,
        "is_agentic": msg.is_agentic, "is_pinned": msg.is_pinned,
        "parent_id": str(msg.parent_id) if msg.parent_id else None,
        "file_url": msg.file_url, "file_name": msg.file_name, "file_type": msg.file_type,
        "reactions": reactions, "reply_count": 0,
        "created_at": msg.created_at.isoformat(), "updated_at": msg.updated_at.isoformat(),
    }


@router.get("/channels/{channel_id}/messages", response_model=PaginatedMessages)
async def get_messages(
    channel_id: uuid.UUID,
    background_tasks: BackgroundTasks,
    page: int = 1,
    page_size: int = 50,
    current_user: UserRead = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    ch_repo = ChannelRepository(db)
    if not await ch_repo.is_member(channel_id, current_user.id):
        raise HTTPException(403, "Not a member")
    msg_repo = MessageRepository(db)
    user_repo = UserRepository(db)
    messages, total = await msg_repo.get_paginated(channel_id, page, page_size)
    _log.info(f"[GET-MESSAGES] user={current_user.id} channel={channel_id} page={page} page_size={page_size} total={total} max_bg={_MAX_BG_TRANSLATIONS}")
    items = []
    to_translate: list[tuple[uuid.UUID, str]] = []
    for msg in messages:
        sender = await user_repo.get_by_id(msg.sender_id)
        # Only serve from cache — never call Ollama synchronously here (CA-04).
        translated = await msg_repo.get_cached_translation(msg.id, current_user.preferred_language)
        # Collect every message not yet cached in the reader's language; they are all
        # translated together in one batched background call below.
        if (
            not translated
            and msg.original_language
            and msg.original_language != current_user.preferred_language
        ):
            preview = (msg.original_content or "")[:100].replace("\n", " ")
            _log.info(
                "Scheduling background translation: message_id=%s source_lang=%s target_lang=%s preview=%r",
                msg.id,
                msg.original_language,
                current_user.preferred_language,
                preview,
            )
            to_translate.append((msg.id, msg.original_content))
        reactions = await msg_repo.get_reactions_grouped(msg.id, current_user.id)
        items.append(MessageRead(**_build_message_read(msg, sender, translated, reactions)))

    if to_translate:
        _log.info(
            "Queueing background translation batch: channel_id=%s user_id=%s page=%d page_size=%d requested=%d queued=%d target_lang=%s",
            channel_id,
            current_user.id,
            page,
            page_size,
            len(to_translate),
            min(len(to_translate), _MAX_BG_TRANSLATIONS),
            current_user.preferred_language,
        )
        background_tasks.add_task(
            _cache_translations_batch_bg,
            channel_id=channel_id,
            user_id=current_user.id,
            target_lang=current_user.preferred_language,
            items=to_translate[:_MAX_BG_TRANSLATIONS],
        )
    return PaginatedMessages(
        items=items, total=total, page=page, page_size=page_size,
        has_more=total > page * page_size,
    )


@router.get("/channels/{channel_id}/messages/pinned", response_model=list[MessageRead])
async def get_pinned(
    channel_id: uuid.UUID,
    current_user: UserRead = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    ch_repo = ChannelRepository(db)
    if not await ch_repo.is_member(channel_id, current_user.id):
        raise HTTPException(403, "Not a member")
    msg_repo = MessageRepository(db)
    user_repo = UserRepository(db)
    messages = await msg_repo.get_pinned(channel_id)
    result = []
    for msg in messages:
        sender = await user_repo.get_by_id(msg.sender_id)
        reactions = await msg_repo.get_reactions_grouped(msg.id, current_user.id)
        translated = await msg_repo.get_cached_translation(msg.id, current_user.preferred_language)
        result.append(MessageRead(**_build_message_read(msg, sender, translated, reactions)))
    return result


@router.get("/channels/{channel_id}/messages/search", response_model=list[MessageRead])
async def search_messages(
    channel_id: uuid.UUID, q: str,
    current_user: UserRead = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    ch_repo = ChannelRepository(db)
    if not await ch_repo.is_member(channel_id, current_user.id):
        raise HTTPException(403, "Not a member")
    msg_repo = MessageRepository(db)
    user_repo = UserRepository(db)
    messages = await msg_repo.full_text_search(channel_id, q)
    result = []
    for msg in messages:
        sender = await user_repo.get_by_id(msg.sender_id)
        reactions = await msg_repo.get_reactions_grouped(msg.id, current_user.id)
        translated = await msg_repo.get_cached_translation(msg.id, current_user.preferred_language)
        result.append(MessageRead(**_build_message_read(msg, sender, translated, reactions)))
    return result


@router.post("/messages/{message_id}/pin", status_code=204)
async def pin_message(
    message_id: uuid.UUID,
    current_user: UserRead = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    msg_repo = MessageRepository(db)
    msg = await msg_repo.get_by_id(message_id)
    if not msg:
        raise HTTPException(404, "Message not found")
    await msg_repo.pin(message_id, not msg.is_pinned)


@router.post("/messages/{message_id}/reactions", status_code=201)
async def add_reaction(
    message_id: uuid.UUID,
    payload: ReactionAdd,
    current_user: UserRead = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    msg_repo = MessageRepository(db)
    try:
        await msg_repo.add_reaction(message_id, current_user.id, payload.emoji)
    except Exception:
        await msg_repo.remove_reaction(message_id, current_user.id, payload.emoji)
    return {"ok": True}


@router.delete("/messages/{message_id}", status_code=204)
async def delete_message(
    message_id: uuid.UUID,
    current_user: UserRead = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    msg_repo = MessageRepository(db)
    msg = await msg_repo.get_by_id(message_id)
    if not msg:
        raise HTTPException(404, "Not found")
    if msg.sender_id != current_user.id:
        raise HTTPException(403, "Cannot delete others' messages")
    await msg_repo.soft_delete(message_id)


# ─── WebSocket ───────────────────────────────────────────────────────────────

@router.websocket("/ws/channels/{channel_id}")
async def websocket_chat(
    websocket: WebSocket,
    channel_id: uuid.UUID,
    token: str,
    db: AsyncSession = Depends(get_db),
):
    # Authenticate WebSocket — Keycloak token, or AUTH_DISABLED bypass.
    from app.core.config.settings import settings
    from app.core.security.keycloak import authenticate_websocket
    from app.services.keycloak_sync_service import KeycloakUserSyncService

    user_repo = UserRepository(db)
    ch_repo = ChannelRepository(db)
    msg_repo = MessageRepository(db)
    notif_repo = NotificationRepository(db)

    if settings.AUTH_DISABLED:
        # Bypass mode: resolve the impersonated user by id WITHOUT upserting.
        # The previous code ran upsert_from_token() with stub claims (no locale,
        # email="bypass@test.local"), which silently reset every seeded user's
        # preferred_language to "fr" and clobbered their email on each WS connect —
        # collapsing the whole multilingual translation demo. We must only READ here.
        dev_user_id = websocket.query_params.get("dev_user_id") or settings.AUTH_DISABLED_USER_ID
        user = None
        if dev_user_id:
            try:
                user = await user_repo.get_by_id(uuid.UUID(dev_user_id))
            except (ValueError, AttributeError):
                user = None
        if not user:
            actives = await user_repo.get_all_active()
            user = actives[0] if actives else None
        if not user:
            await websocket.close(code=1008)
            return
    else:
        try:
            claims = await authenticate_websocket(websocket)
        except RuntimeError:
            return
        # Lazy-sync user
        sync_service = KeycloakUserSyncService(db)
        user = await sync_service.upsert_from_token(claims)

    user_id = user.id

    # Verify channel membership
    if not await ch_repo.is_member(channel_id, user_id):
        await websocket.close(code=1008)
        return

    await connection_manager.connect(websocket, channel_id, user_id)

    # Notify others that user is online
    await connection_manager.broadcast_except(channel_id, user_id, {
        "type": "presence", "data": {"user_id": str(user_id), "username": user.username, "status": "online"}
    })

    try:
        while True:
            raw = await websocket.receive_text()
            data = json.loads(raw)
            event_type = data.get("type")

            if event_type == "message":
                content = data.get("content", "").strip()
                parent_id_str = data.get("parent_id")
                parent_id = uuid.UUID(parent_id_str) if parent_id_str else None
                if not content:
                    continue

                # Fall back to the sender's own language when detection is
                # uncertain (short messages) instead of a hard-coded constant.
                source_lang = await detect_language(content, default=user.preferred_language)
                _log.info(f"[WS-NEW-MSG] message_id={msg.id} sender={user.username} lang={source_lang} len={len(content)}")

                msg = await msg_repo.create(
                    channel_id=channel_id, sender_id=user_id,
                    content=content, language=source_lang,
                    is_agentic=False, parent_id=parent_id,
                )
                # Commit immediately so the message survives even if later
                # steps (translation, agentic replies) raise an exception.
                await db.commit()

                members = await ch_repo.get_members(channel_id)

                # Broadcast immediately with original content (translated_content=None so each
                # user sees the source text until their personal translation arrives, CA-01/CA-03).
                for member in members:
                    await connection_manager.send_to_user(channel_id, member.id, {
                        "type": "message",
                        "data": _build_message_read(msg, user, None, []),
                    })

                # Translate in background — never block the WS loop.
                target_langs = list({m.preferred_language for m in members})
                _log.info(f"[WS-TRANSLATE-START] message_id={msg.id} source_lang={source_lang} target_langs={target_langs}")

                async def _do_translate(
                    msg_id=msg.id, text=content,
                    src=source_lang, tgt_langs=target_langs,
                    _members=members,
                ):
                    _log.info(f"[WS-TRANSLATE-BG] Starting bg translation for msg {msg_id} to {len(tgt_langs)} languages")
                    async with AsyncSessionLocal() as bg_db:
                        try:
                            translations = await translation_svc.translate_for_members(
                                db=bg_db, message_id=msg_id, text=text,
                                source_language=src, target_languages=tgt_langs,
                            )
                            _log.info(f"[WS-TRANSLATE-SAVE] Got {len(translations)} translations, saving to DB")
                            await bg_db.commit()
                            _log.info(f"[WS-TRANSLATE-NOTIFY] Sending notifications for {len(translations)} translations")
                            for m in _members:
                                translated = translations.get(m.preferred_language, text)
                                if translated != text:
                                    await connection_manager.send_to_user(channel_id, m.id, {
                                        "type": "message_translated",
                                        "data": {"message_id": str(msg_id), "translated_content": translated},
                                    })
                            _log.info(f"[WS-TRANSLATE-OK] Completed translation for msg {msg_id}")
                        except Exception as exc:
                            _log.error(
                                "[WS-TRANSLATE-FAIL] Background translation failed for message %s: %s",
                                msg_id, exc, exc_info=True
                            )

                asyncio.create_task(_do_translate())

                # Check for mentions
                has_mention = False
                for member in members:
                    if f"@{member.username}" in content and member.id != user_id:
                        await notif_repo.create(
                            user_id=member.id, type="mention",
                            channel_id=channel_id, message_id=msg.id,
                            content=f"{user.username} mentioned you",
                        )
                        has_mention = True
                if has_mention:
                    await db.commit()

                # Trigger agentic replies (best-effort — never crash the WS)
                try:
                    await _handle_agentic_replies(
                        members=members, sender_id=user_id, channel_id=channel_id,
                        incoming=content, msg_repo=msg_repo, notif_repo=notif_repo,
                    )
                except Exception as exc:
                    logging.getLogger(__name__).warning(
                        "Agentic reply failed for channel %s: %s", channel_id, exc
                    )

            elif event_type == "typing":
                await connection_manager.broadcast_except(channel_id, user_id, {
                    "type": "typing",
                    "data": {"user_id": str(user_id), "username": user.username},
                })

    except WebSocketDisconnect:
        connection_manager.disconnect(channel_id, user_id)
        await connection_manager.broadcast_except(channel_id, user_id, {
            "type": "presence", "data": {"user_id": str(user_id), "username": user.username, "status": "offline"}
        })


async def _handle_agentic_replies(members, sender_id, channel_id, incoming, msg_repo, notif_repo):
    """Triggers Gemma 4 backup replies for agentic users not online."""
    for member in members:
        if member.id == sender_id:
            continue
        if member.status != "agentic" or not member.agentic_enabled:
            continue
        if connection_manager.is_connected(channel_id, member.id):
            continue

        context_msgs = await msg_repo.get_recent(channel_id, limit=20)
        context_dicts = [
            {"sender_username": m.sender_id, "original_content": m.original_content, "is_agentic": m.is_agentic}
            for m in context_msgs
        ]

        reply = await agent_svc.generate_backup_reply(
            username=member.username,
            preferred_language=member.preferred_language,
            agentic_persona=member.agentic_persona,
            context_messages=context_dicts,
            incoming=incoming,
        )

        agentic_msg = await msg_repo.create(
            channel_id=channel_id, sender_id=member.id,
            content=reply, language=member.preferred_language,
            is_agentic=True,
        )

        await connection_manager.broadcast(channel_id, {
            "type": "message",
            "data": {
                "id": str(agentic_msg.id), "channel_id": str(channel_id),
                "sender_id": str(member.id), "sender_username": member.username,
                "sender_avatar": member.avatar_url,
                "original_content": reply, "translated_content": reply,
                "original_language": member.preferred_language,
                "is_agentic": True, "is_pinned": False, "parent_id": None,
                "file_url": None, "file_name": None, "file_type": None,
                "reactions": [], "reply_count": 0,
                "created_at": agentic_msg.created_at.isoformat(),
                "updated_at": agentic_msg.updated_at.isoformat(),
            },
        })

        await notif_repo.create(
            user_id=member.id, type="agentic_reply",
            channel_id=channel_id, message_id=agentic_msg.id,
            content="Your AI agent replied on your behalf",
        )
