"""Pydantic v2 schemas — DTOs for API request/response."""
import uuid
from datetime import datetime
from pydantic import BaseModel, EmailStr, field_validator
from typing import Optional


# ─── Auth ────────────────────────────────────────────────────────────────────

class RegisterRequest(BaseModel):
    email: EmailStr
    username: str
    password: str
    preferred_language: str = "fr"

    @field_validator("username")
    @classmethod
    def username_valid(cls, v):
        if len(v) < 3 or len(v) > 30:
            raise ValueError("Username must be 3-30 characters")
        return v.lower()

    @field_validator("password")
    @classmethod
    def password_strength(cls, v):
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters")
        return v


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class RefreshRequest(BaseModel):
    refresh_token: str


# ─── User ────────────────────────────────────────────────────────────────────

class UserRead(BaseModel):
    id: uuid.UUID
    email: str
    username: str
    preferred_language: str
    status: str
    agentic_enabled: bool
    agentic_persona: Optional[str]
    avatar_url: Optional[str]
    created_at: datetime
    model_config = {"from_attributes": True}


class UserPublic(BaseModel):
    """Public user info — safe to expose to other users."""
    id: uuid.UUID
    username: str
    preferred_language: str
    status: str
    avatar_url: Optional[str]
    model_config = {"from_attributes": True}


class UserUpdateRequest(BaseModel):
    preferred_language: Optional[str] = None
    agentic_enabled: Optional[bool] = None
    agentic_persona: Optional[str] = None



class UserStatusUpdate(BaseModel):
    status: str

    @field_validator("status")
    @classmethod
    def status_valid(cls, v: str) -> str:
        allowed = {"active", "agentic", "inactive", "absent", "communication"}
        if v not in allowed:
            raise ValueError(f"status must be one of {sorted(allowed)}")
        return v


# ─── Channel ─────────────────────────────────────────────────────────────────

class ChannelCreate(BaseModel):
    name: str
    description: Optional[str] = None
    type: str = "team"
    member_ids: list[uuid.UUID] = []


class ChannelRead(BaseModel):
    id: uuid.UUID
    name: str
    description: Optional[str]
    type: str
    created_by: uuid.UUID
    is_archived: bool
    created_at: datetime
    member_count: int = 0
    unread_count: int = 0
    model_config = {"from_attributes": True}


class MemberRead(BaseModel):
    user: UserPublic
    role: str
    joined_at: datetime
    model_config = {"from_attributes": True}


# ─── Message ─────────────────────────────────────────────────────────────────

class MessageSend(BaseModel):
    content: str
    parent_id: Optional[uuid.UUID] = None


class ReactionRead(BaseModel):
    emoji: str
    count: int
    reacted_by_me: bool


class MessageRead(BaseModel):
    id: uuid.UUID
    channel_id: uuid.UUID
    sender_id: uuid.UUID
    sender_username: str
    sender_avatar: Optional[str]
    original_content: str
    translated_content: Optional[str] = None
    original_language: str
    is_agentic: bool
    is_pinned: bool
    parent_id: Optional[uuid.UUID]
    file_url: Optional[str]
    file_name: Optional[str]
    file_type: Optional[str]
    reactions: list[ReactionRead] = []
    reply_count: int = 0
    created_at: datetime
    updated_at: datetime
    model_config = {"from_attributes": True}


class MessageUpdate(BaseModel):
    content: str


class ReactionAdd(BaseModel):
    emoji: str


class PaginatedMessages(BaseModel):
    items: list[MessageRead]
    total: int
    page: int
    page_size: int
    has_more: bool


# ─── WebSocket ───────────────────────────────────────────────────────────────

class WsEvent(BaseModel):
    type: str
    data: dict


# ─── Notifications ───────────────────────────────────────────────────────────

class NotificationRead(BaseModel):
    id: uuid.UUID
    type: str
    channel_id: Optional[uuid.UUID]
    message_id: Optional[uuid.UUID]
    content: Optional[str]
    is_read: bool
    created_at: datetime
    model_config = {"from_attributes": True}


# ─── AI ──────────────────────────────────────────────────────────────────────

class SummaryResponse(BaseModel):
    channel_id: uuid.UUID
    summary: str
    generated_at: datetime


class ActionPlanResponse(BaseModel):
    channel_id: uuid.UUID
    action_plan: str
    generated_at: datetime


class AIHealthResponse(BaseModel):
    provider: str
    model: str
    available: bool
    message: str


# --- Agent ---

class AgentRead(BaseModel):
    id: uuid.UUID
    name: str
    description: Optional[str]
    agent_type: str
    persona: Optional[str]
    is_active: bool
    model_config = {"from_attributes": True}
