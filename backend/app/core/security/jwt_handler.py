"""JWT token handling with Keycloak integration.

This module handles:
- Keycloak token validation via RS256 JWKS (new primary method)
- Legacy JWT creation/validation (kept for backward compatibility, not used)
- AUTH_DISABLED mode: bypass all authentication for local development
"""
import uuid
from datetime import datetime, timedelta, timezone
from fastapi import Depends, Header, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt

from app.core.config.settings import settings
from app.core.security.keycloak import validate_keycloak_token
from app.schemas.schemas import UserRead

security = HTTPBearer(auto_error=False)


# ─── Legacy functions (kept for backward compatibility) ───────────────────


def create_access_token(user_id: str) -> str:
    """Legacy: create HS256 token (not used with Keycloak)."""
    exp = datetime.now(timezone.utc) + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    return jwt.encode(
        {"sub": user_id, "exp": exp, "type": "access"},
        settings.SECRET_KEY,
        algorithm=settings.ALGORITHM,
    )


def create_refresh_token(user_id: str) -> str:
    """Legacy: create HS256 refresh token (not used with Keycloak)."""
    exp = datetime.now(timezone.utc) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    return jwt.encode(
        {"sub": user_id, "exp": exp, "type": "refresh"},
        settings.SECRET_KEY,
        algorithm=settings.ALGORITHM,
    )


def decode_token(token: str) -> dict | None:
    """Legacy: decode HS256 token (not used with Keycloak)."""
    try:
        return jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
    except JWTError:
        return None


# ─── Keycloak & Bypass Auth ─────────────────────────────────────────────


async def _get_bypass_user(user_id_override: str | None = None) -> UserRead:
    """Returns the user for AUTH_DISABLED mode.

    Priority order:
    1. user_id_override (from X-Dev-User-Id header or dev_user_id WS param)
    2. AUTH_DISABLED_USER_ID env var
    3. First active user in DB
    """
    from app.core.database import AsyncSessionLocal
    from app.repositories.repositories import UserRepository
    from sqlalchemy import select
    from app.models.models import User

    async with AsyncSessionLocal() as db:
        repo = UserRepository(db)
        uid = user_id_override or settings.AUTH_DISABLED_USER_ID or None
        if uid:
            try:
                user = await repo.get_by_id(uuid.UUID(uid))
            except (ValueError, AttributeError):
                user = None
        else:
            user = None

        if not user:
            result = await db.execute(select(User).where(User.is_active == True).limit(1))
            user = result.scalar_one_or_none()

        if not user:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="AUTH_DISABLED is on but no user found — run seed first",
            )
        return UserRead.model_validate(user)


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    x_dev_user_id: str | None = Header(default=None, alias="X-Dev-User-Id"),
) -> UserRead:
    """FastAPI dependency — authenticate user via Keycloak or AUTH_DISABLED bypass.
    
    Flow:
    1. If AUTH_DISABLED=true: return bypass user identified by X-Dev-User-Id header
       (or AUTH_DISABLED_USER_ID env var, or first active user)
    2. Otherwise: validate Keycloak token (RS256 via JWKS)
    3. Perform lazy-sync: create/update user in local DB
    4. Return UserRead object
    
    Raises:
        HTTPException(401): Missing or invalid token (AUTH_DISABLED=false)
        HTTPException(503): Keycloak unreachable or no user in DB (AUTH_DISABLED=true)
    """
    if settings.AUTH_DISABLED:
        return await _get_bypass_user(x_dev_user_id)

    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
        )

    # Validate token via Keycloak JWKS
    claims = await validate_keycloak_token(credentials.credentials)

    # Lazy-sync user
    from app.core.database import AsyncSessionLocal
    from app.services.keycloak_sync_service import KeycloakUserSyncService

    async with AsyncSessionLocal() as db:
        sync_service = KeycloakUserSyncService(db)
        user = await sync_service.upsert_from_token(claims)
        return user

