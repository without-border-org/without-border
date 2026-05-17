"""Repositories — data access layer. One class per model aggregate."""
import uuid
from sqlalchemy import select, func, update, and_, delete
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from app.models.models import (
    User, Channel, ChannelMember, Message,
    MessageTranslation, MessageReaction, Notification, Agent
)


class UserRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def create(self, *, email: str, username: str, hashed_password: str, preferred_language: str) -> User:
        user = User(email=email, username=username, hashed_password=hashed_password, preferred_language=preferred_language)
        self.db.add(user)
        await self.db.flush()
        await self.db.refresh(user)
        return user

    async def get_by_id(self, user_id: uuid.UUID) -> User | None:
        r = await self.db.execute(select(User).where(User.id == user_id))
        return r.scalar_one_or_none()

    async def get_by_email(self, email: str) -> User | None:
        r = await self.db.execute(select(User).where(User.email == email))
        return r.scalar_one_or_none()

    async def get_by_username(self, username: str) -> User | None:
        r = await self.db.execute(select(User).where(User.username == username))
        return r.scalar_one_or_none()

    async def search(self, query: str, limit: int = 10) -> list[User]:
        r = await self.db.execute(
            select(User).where(User.username.ilike(f"%{query}%"), User.is_active == True).limit(limit)
        )
        return list(r.scalars().all())

    async def update(self, user_id: uuid.UUID, **kwargs) -> User | None:
        await self.db.execute(update(User).where(User.id == user_id).values(**kwargs))
        await self.db.flush()
        return await self.get_by_id(user_id)

    async def get_unread_notification_count(self, user_id: uuid.UUID) -> int:
        r = await self.db.execute(
            select(func.count()).where(Notification.user_id == user_id, Notification.is_read == False)
        )
        return r.scalar() or 0


class ChannelRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def create(self, *, name: str, description: str | None, channel_type: str, created_by: uuid.UUID) -> Channel:
        channel = Channel(name=name, description=description, type=channel_type, created_by=created_by)
        self.db.add(channel)
        await self.db.flush()
        await self.db.refresh(channel)
        return channel

    async def get_by_id(self, channel_id: uuid.UUID) -> Channel | None:
        r = await self.db.execute(select(Channel).where(Channel.id == channel_id))
        return r.scalar_one_or_none()

    async def get_user_channels(self, user_id: uuid.UUID) -> list[Channel]:
        r = await self.db.execute(
            select(Channel)
            .join(ChannelMember, ChannelMember.channel_id == Channel.id)
            .where(ChannelMember.user_id == user_id, Channel.is_archived == False)
            .order_by(Channel.id.asc())
        )
        return list(r.scalars().all())

    async def get_message_count(self, channel_id: uuid.UUID) -> int:
        r = await self.db.execute(
            select(func.count()).where(Message.channel_id == channel_id)
        )
        return r.scalar() or 0

    async def get_members(self, channel_id: uuid.UUID) -> list[User]:
        r = await self.db.execute(
            select(User)
            .join(ChannelMember, ChannelMember.user_id == User.id)
            .where(ChannelMember.channel_id == channel_id, User.is_active == True)
        )
        return list(r.scalars().all())

    async def get_member_count(self, channel_id: uuid.UUID) -> int:
        r = await self.db.execute(
            select(func.count()).where(ChannelMember.channel_id == channel_id)
        )
        return r.scalar() or 0

    async def add_member(self, channel_id: uuid.UUID, user_id: uuid.UUID, role: str = "member") -> ChannelMember:
        member = ChannelMember(channel_id=channel_id, user_id=user_id, role=role)
        self.db.add(member)
        await self.db.flush()
        return member

    async def remove_member(self, channel_id: uuid.UUID, user_id: uuid.UUID) -> None:
        await self.db.execute(
            delete(ChannelMember).where(
                ChannelMember.channel_id == channel_id, ChannelMember.user_id == user_id
            )
        )

    async def is_member(self, channel_id: uuid.UUID, user_id: uuid.UUID) -> bool:
        r = await self.db.execute(
            select(ChannelMember).where(
                ChannelMember.channel_id == channel_id, ChannelMember.user_id == user_id
            )
        )
        return r.scalar_one_or_none() is not None

    async def get_member_role(self, channel_id: uuid.UUID, user_id: uuid.UUID) -> str | None:
        r = await self.db.execute(
            select(ChannelMember.role).where(
                ChannelMember.channel_id == channel_id, ChannelMember.user_id == user_id
            )
        )
        return r.scalar_one_or_none()


class MessageRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def create(self, *, channel_id: uuid.UUID, sender_id: uuid.UUID, content: str,
                     language: str, is_agentic: bool = False, parent_id: uuid.UUID | None = None,
                     file_url: str | None = None, file_name: str | None = None, file_type: str | None = None) -> Message:
        msg = Message(
            channel_id=channel_id, sender_id=sender_id, original_content=content,
            original_language=language, is_agentic=is_agentic, parent_id=parent_id,
            file_url=file_url, file_name=file_name, file_type=file_type,
        )
        self.db.add(msg)
        await self.db.flush()
        await self.db.refresh(msg)
        return msg

    async def get_by_id(self, message_id: uuid.UUID) -> Message | None:
        r = await self.db.execute(select(Message).where(Message.id == message_id))
        return r.scalar_one_or_none()

    async def get_paginated(self, channel_id: uuid.UUID, page: int = 1, page_size: int = 50) -> tuple[list[Message], int]:
        offset = (page - 1) * page_size
        count_q = await self.db.execute(
            select(func.count()).where(Message.channel_id == channel_id, Message.deleted_at == None, Message.parent_id == None)
        )
        total = count_q.scalar() or 0
        r = await self.db.execute(
            select(Message)
            .options(selectinload(Message.reactions), selectinload(Message.sender))
            .where(Message.channel_id == channel_id, Message.deleted_at == None, Message.parent_id == None)
            .order_by(Message.created_at.desc())
            .offset(offset).limit(page_size)
        )
        items = list(reversed(r.scalars().all()))
        return items, total

    async def get_recent(self, channel_id: uuid.UUID, limit: int = 20) -> list[Message]:
        r = await self.db.execute(
            select(Message)
            .where(Message.channel_id == channel_id, Message.deleted_at == None)
            .order_by(Message.created_at.desc()).limit(limit)
        )
        return list(reversed(r.scalars().all()))

    async def get_pinned(self, channel_id: uuid.UUID) -> list[Message]:
        r = await self.db.execute(
            select(Message).where(Message.channel_id == channel_id, Message.is_pinned == True, Message.deleted_at == None)
        )
        return list(r.scalars().all())

    async def get_cached_translation(self, message_id: uuid.UUID, language: str) -> str | None:
        r = await self.db.execute(
            select(MessageTranslation.translated_content).where(
                MessageTranslation.message_id == message_id,
                MessageTranslation.target_language == language
            )
        )
        return r.scalar_one_or_none()

    async def save_translation(self, message_id: uuid.UUID, language: str, content: str) -> MessageTranslation:
        t = MessageTranslation(message_id=message_id, target_language=language, translated_content=content)
        self.db.add(t)
        await self.db.flush()
        return t

    async def soft_delete(self, message_id: uuid.UUID) -> None:
        from datetime import datetime, timezone
        await self.db.execute(
            update(Message).where(Message.id == message_id).values(deleted_at=datetime.now(timezone.utc))
        )

    async def pin(self, message_id: uuid.UUID, pinned: bool) -> None:
        await self.db.execute(update(Message).where(Message.id == message_id).values(is_pinned=pinned))

    async def add_reaction(self, message_id: uuid.UUID, user_id: uuid.UUID, emoji: str) -> MessageReaction:
        r = MessageReaction(message_id=message_id, user_id=user_id, emoji=emoji)
        self.db.add(r)
        await self.db.flush()
        return r

    async def remove_reaction(self, message_id: uuid.UUID, user_id: uuid.UUID, emoji: str) -> None:
        await self.db.execute(
            delete(MessageReaction).where(
                MessageReaction.message_id == message_id,
                MessageReaction.user_id == user_id,
                MessageReaction.emoji == emoji,
            )
        )

    async def get_reactions_grouped(self, message_id: uuid.UUID, current_user_id: uuid.UUID) -> list[dict]:
        r = await self.db.execute(
            select(MessageReaction.emoji, func.count().label("count"))
            .where(MessageReaction.message_id == message_id)
            .group_by(MessageReaction.emoji)
        )
        rows = r.all()
        result = []
        for emoji, count in rows:
            me_r = await self.db.execute(
                select(MessageReaction).where(
                    MessageReaction.message_id == message_id,
                    MessageReaction.user_id == current_user_id,
                    MessageReaction.emoji == emoji,
                )
            )
            result.append({"emoji": emoji, "count": count, "reacted_by_me": me_r.scalar_one_or_none() is not None})
        return result

    async def full_text_search(self, channel_id: uuid.UUID, query: str, limit: int = 20) -> list[Message]:
        r = await self.db.execute(
            select(Message).where(
                Message.channel_id == channel_id,
                Message.original_content.ilike(f"%{query}%"),
                Message.deleted_at == None,
            ).order_by(Message.created_at.desc()).limit(limit)
        )
        return list(r.scalars().all())


class NotificationRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def create(self, *, user_id: uuid.UUID, type: str, channel_id: uuid.UUID | None = None,
                     message_id: uuid.UUID | None = None, content: str | None = None) -> Notification:
        n = Notification(user_id=user_id, type=type, channel_id=channel_id, message_id=message_id, content=content)
        self.db.add(n)
        await self.db.flush()
        return n

    async def get_user_notifications(self, user_id: uuid.UUID, limit: int = 20) -> list[Notification]:
        r = await self.db.execute(
            select(Notification).where(Notification.user_id == user_id)
            .order_by(Notification.created_at.desc()).limit(limit)
        )
        return list(r.scalars().all())

    async def mark_all_read(self, user_id: uuid.UUID) -> None:
        await self.db.execute(
            update(Notification).where(Notification.user_id == user_id).values(is_read=True)
        )


class AgentRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def list_all(self) -> list[Agent]:
        result = await self.db.execute(select(Agent).where(Agent.is_active == True))
        return list(result.scalars().all())
