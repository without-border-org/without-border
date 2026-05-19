"""User endpoints — profile, status, avatar, search, notifications."""
import os
import uuid
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.core.security.jwt_handler import get_current_user
from app.core.config.settings import settings
from app.repositories.repositories import UserRepository, NotificationRepository
from app.schemas.schemas import (
    UserRead, UserUpdateRequest, UserStatusUpdate, UserPublic, NotificationRead
)
import aiofiles

router = APIRouter(prefix="/users", tags=["users"])


@router.get("/dev/list", response_model=list[UserPublic])
async def list_dev_users(db: AsyncSession = Depends(get_db)):
    """Return all active users for the dev user-picker. Only available when AUTH_DISABLED=true."""
    if not settings.AUTH_DISABLED:
        from fastapi import status as http_status
        raise HTTPException(status_code=http_status.HTTP_404_NOT_FOUND, detail="Not found")
    repo = UserRepository(db)
    return await repo.get_all_active()


@router.get("/me", response_model=UserRead)
async def get_me(current_user: UserRead = Depends(get_current_user)):
    return current_user


@router.put("/me", response_model=UserRead)
async def update_me(
    payload: UserUpdateRequest,
    current_user: UserRead = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    repo = UserRepository(db)
    update_data = payload.model_dump(exclude_none=True)
    user = await repo.update(current_user.id, **update_data)
    return UserRead.model_validate(user)


@router.put("/me/status", response_model=UserRead)
async def update_status(
    payload: UserStatusUpdate,
    current_user: UserRead = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    repo = UserRepository(db)
    user = await repo.update(current_user.id, status=payload.status)
    return UserRead.model_validate(user)


@router.post("/me/avatar", response_model=UserRead)
async def upload_avatar(
    file: UploadFile = File(...),
    current_user: UserRead = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if not file.content_type.startswith("image/"):
        raise HTTPException(400, "File must be an image")
    ext = file.filename.split(".")[-1]
    filename = f"avatar_{current_user.id}.{ext}"
    filepath = os.path.join(settings.UPLOAD_DIR, filename)
    async with aiofiles.open(filepath, "wb") as f:
        content = await file.read()
        await f.write(content)
    avatar_url = f"/uploads/{filename}"
    repo = UserRepository(db)
    user = await repo.update(current_user.id, avatar_url=avatar_url)
    return UserRead.model_validate(user)


@router.get("/search", response_model=list[UserPublic])
async def search_users(
    q: str,
    current_user: UserRead = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if len(q) < 2:
        raise HTTPException(400, "Query too short")
    repo = UserRepository(db)
    users = await repo.search(q)
    return [UserPublic.model_validate(u) for u in users if u.id != current_user.id]


@router.get("/me/notifications", response_model=list[NotificationRead])
async def get_notifications(
    current_user: UserRead = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    repo = NotificationRepository(db)
    notifs = await repo.get_user_notifications(current_user.id)
    return [NotificationRead.model_validate(n) for n in notifs]


@router.put("/me/notifications/read-all", status_code=204)
async def mark_all_read(
    current_user: UserRead = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    repo = NotificationRepository(db)
    await repo.mark_all_read(current_user.id)
