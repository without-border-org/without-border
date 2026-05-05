"""JWT token creation and validation.

AUTH_DISABLED mode:
  Set AUTH_DISABLED=true in .env to bypass all authentication.
  When enabled, every request is treated as the first demo user (sophie).
  USE ONLY FOR LOCAL DEVELOPMENT — never in production.
"""
import uuid
from datetime import datetime, timedelta, timezone
from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from app.core.config.settings import settings

security = HTTPBearer(auto_error=False)


def create_access_token(user_id: str) -> str:
    exp = datetime.now(timezone.utc) + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    return jwt.encode({"sub": user_id, "exp": exp, "type": "access"}, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def create_refresh_token(user_id: str) -> str:
    exp = datetime.now(timezone.utc) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    return jwt.encode({"sub": user_id, "exp": exp, "type": "refresh"}, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def decode_token(token: str) -> dict | None:
    try:
        return jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
    except JWTError:
        return None


async def _get_bypass_user():
    """Returns the first active user when AUTH_DISABLED=true."""
    from app.schemas.schemas import UserRead
    from app.core.database import AsyncSessionLocal
    from app.repositories.repositories import UserRepository
    from sqlalchemy import select
    from app.models.models import User

    async with AsyncSessionLocal() as db:
        repo = UserRepository(db)
        # Use configured user id, or fall back to first user in DB
        if settings.AUTH_DISABLED_USER_ID:
            user = await repo.get_by_id(uuid.UUID(settings.AUTH_DISABLED_USER_ID))
        else:
            result = await db.execute(select(User).where(User.is_active == True).limit(1))
            user = result.scalar_one_or_none()

        if not user:
            raise HTTPException(status_code=503, detail="AUTH_DISABLED is on but no user found — run seed first")
        return UserRead.model_validate(user)


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
):
    """FastAPI dependency — returns the current authenticated user.

    If AUTH_DISABLED=true, skips token validation and returns
    the first active user (or AUTH_DISABLED_USER_ID if set).
    """
    from app.schemas.schemas import UserRead
    from app.core.database import AsyncSessionLocal
    from app.repositories.repositories import UserRepository

    if settings.AUTH_DISABLED:
        return await _get_bypass_user()

    if not credentials:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authenticated")

    payload = decode_token(credentials.credentials)
    if not payload or payload.get("type") != "access":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token")

    async with AsyncSessionLocal() as db:
        repo = UserRepository(db)
        user = await repo.get_by_id(uuid.UUID(payload["sub"]))
        if not user or not user.is_active:
            raise HTTPException(status_code=401, detail="User not found or inactive")
        return UserRead.model_validate(user)
