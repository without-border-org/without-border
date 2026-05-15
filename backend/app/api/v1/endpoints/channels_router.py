"""Channel endpoints — CRUD channels, members management."""
import uuid
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.core.security.jwt_handler import get_current_user
from app.repositories.repositories import ChannelRepository, UserRepository
from app.schemas.schemas import ChannelCreate, ChannelRead, MemberRead, UserPublic, UserRead

router = APIRouter(prefix="/channels", tags=["channels"])


@router.get("", response_model=list[ChannelRead])
async def list_channels(
    current_user: UserRead = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    repo = ChannelRepository(db)
    channels = await repo.get_user_channels(current_user.id)
    result = []
    for ch in channels:
        member_count = await repo.get_member_count(ch.id)
        msg_count = await repo.get_message_count(ch.id)
        r = ChannelRead.model_validate(ch)
        r.member_count = member_count
        r.unread_count = msg_count
        result.append(r)
    return result


@router.post("", response_model=ChannelRead, status_code=201)
async def create_channel(
    payload: ChannelCreate,
    current_user: UserRead = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    repo = ChannelRepository(db)
    channel = await repo.create(
        name=payload.name, description=payload.description,
        channel_type=payload.type, created_by=current_user.id,
    )
    await repo.add_member(channel.id, current_user.id, role="admin")
    for uid in payload.member_ids:
        if uid != current_user.id:
            await repo.add_member(channel.id, uid)
    count = await repo.get_member_count(channel.id)
    result = ChannelRead.model_validate(channel)
    result.member_count = count
    return result


@router.get("/{channel_id}", response_model=ChannelRead)
async def get_channel(
    channel_id: uuid.UUID,
    current_user: UserRead = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    repo = ChannelRepository(db)
    if not await repo.is_member(channel_id, current_user.id):
        raise HTTPException(403, "Not a member")
    channel = await repo.get_by_id(channel_id)
    if not channel:
        raise HTTPException(404, "Channel not found")
    count = await repo.get_member_count(channel_id)
    result = ChannelRead.model_validate(channel)
    result.member_count = count
    return result


@router.get("/{channel_id}/members", response_model=list[UserPublic])
async def get_members(
    channel_id: uuid.UUID,
    current_user: UserRead = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    repo = ChannelRepository(db)
    if not await repo.is_member(channel_id, current_user.id):
        raise HTTPException(403, "Not a member")
    members = await repo.get_members(channel_id)
    return [UserPublic.model_validate(m) for m in members]


@router.post("/{channel_id}/members", status_code=201)
async def add_member(
    channel_id: uuid.UUID,
    user_id: uuid.UUID,
    current_user: UserRead = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    repo = ChannelRepository(db)
    if await repo.get_member_role(channel_id, current_user.id) != "admin":
        raise HTTPException(403, "Admin required")
    if await repo.is_member(channel_id, user_id):
        raise HTTPException(409, "User already a member")
    await repo.add_member(channel_id, user_id)
    return {"message": "Member added"}


@router.delete("/{channel_id}/members/{user_id}", status_code=204)
async def remove_member(
    channel_id: uuid.UUID,
    user_id: uuid.UUID,
    current_user: UserRead = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    repo = ChannelRepository(db)
    if current_user.id != user_id and await repo.get_member_role(channel_id, current_user.id) != "admin":
        raise HTTPException(403, "Forbidden")
    await repo.remove_member(channel_id, user_id)
