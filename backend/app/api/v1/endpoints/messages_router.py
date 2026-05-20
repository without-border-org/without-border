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

# Maximum background translations queued per GET /messages request to avoid Ollama overload.
# Set to 50 to ensure all messages on a standard page get translated on first load (WB-10).
_MAX_BG_TRANSLATIONS = 50


async def _cache_translation_bg(
    channel_id: uuid.UUID, user_id: uuid.UUID,
    message_id: uuid.UUID, text: str,
    source_lang: str, target_lang: str,
) -> None:
    """Generates and caches a missing translation in the background, then notifies the user via WS."""
    async with AsyncSessionLocal() as bg_db:
        try:
            msg_repo = MessageRepository(bg_db)
            cached = await msg_repo.get_cached_translation(message_id, target_lang)
            if not cached:
                translated = await translation_svc.translate(text, target_lang, source_lang)
                await msg_repo.save_translation(message_id, target_lang, translated)
                await bg_db.commit()
                await connection_manager.send_to_user(channel_id, user_id, {
                    "type": "message_translated",
                    "data": {"message_id": str(message_id), "translated_content": translated},
                })
        except Exception as exc:
            logging.getLogger(__name__).warning(
                "BG translation failed for msg %s lang %s: %s", message_id, target_lang, exc
            )


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
    items = []
    bg_count = 0
    for msg in messages:
        sender = await user_repo.get_by_id(msg.sender_id)
        # Only serve from cache — never call Ollama synchronously here (CA-04).
        translated = await msg_repo.get_cached_translation(msg.id, current_user.preferred_language)
        # Queue background translation for messages not yet cached for this user's language.
        if (
            not translated
            and msg.original_language
            and msg.original_language != current_user.preferred_language
            and bg_count < _MAX_BG_TRANSLATIONS
        ):
            background_tasks.add_task(
                _cache_translation_bg,
                channel_id=channel_id,
                user_id=current_user.id,
                message_id=msg.id,
                text=msg.original_content,
                source_lang=msg.original_language,
                target_lang=current_user.preferred_language,
            )
            bg_count += 1
        reactions = await msg_repo.get_reactions_grouped(msg.id, current_user.id)
        items.append(MessageRead(**_build_message_read(msg, sender, translated, reactions)))
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
        result.append(MessageRead(**_build_message_read(msg, sender, None, reactions)))
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
        result.append(MessageRead(**_build_message_read(msg, sender, None, reactions)))
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
    # Authenticate WebSocket via Keycloak token
    from app.core.security.keycloak import authenticate_websocket
    from app.services.keycloak_sync_service import KeycloakUserSyncService
    
    try:
        claims = await authenticate_websocket(websocket)
    except RuntimeError:
        return
    
    # Lazy-sync user
    sync_service = KeycloakUserSyncService(db)
    user = await sync_service.upsert_from_token(claims)
    user_id = user.id
    
    user_repo = UserRepository(db)
    ch_repo = ChannelRepository(db)
    msg_repo = MessageRepository(db)
    notif_repo = NotificationRepository(db)

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

                source_lang = await detect_language(content)

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

                async def _do_translate(
                    msg_id=msg.id, text=content,
                    src=source_lang, tgt_langs=target_langs,
                    _members=members,
                ):
                    async with AsyncSessionLocal() as bg_db:
                        try:
                            translations = await translation_svc.translate_for_members(
                                db=bg_db, message_id=msg_id, text=text,
                                source_language=src, target_languages=tgt_langs,
                            )
                            await bg_db.commit()
                            for m in _members:
                                translated = translations.get(m.preferred_language, text)
                                if translated != text:
                                    await connection_manager.send_to_user(channel_id, m.id, {
                                        "type": "message_translated",
                                        "data": {"message_id": str(msg_id), "translated_content": translated},
                                    })
                        except Exception as exc:
                            logging.getLogger(__name__).warning(
                                "Background translation failed for message %s: %s", msg_id, exc
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
