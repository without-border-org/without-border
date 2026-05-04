"""Auth endpoints — register, login, refresh, logout."""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.core.security.jwt_handler import create_access_token, create_refresh_token, decode_token
from app.core.security.password_handler import hash_password, verify_password
from app.repositories.repositories import UserRepository
from app.schemas.schemas import LoginRequest, RegisterRequest, TokenResponse, RefreshRequest

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=TokenResponse, status_code=201)
async def register(payload: RegisterRequest, db: AsyncSession = Depends(get_db)):
    repo = UserRepository(db)
    if await repo.get_by_email(payload.email):
        raise HTTPException(409, "Email already registered")
    if await repo.get_by_username(payload.username):
        raise HTTPException(409, "Username already taken")
    user = await repo.create(
        email=payload.email, username=payload.username,
        hashed_password=hash_password(payload.password),
        preferred_language=payload.preferred_language,
    )
    return TokenResponse(
        access_token=create_access_token(str(user.id)),
        refresh_token=create_refresh_token(str(user.id)),
    )


@router.post("/login", response_model=TokenResponse)
async def login(payload: LoginRequest, db: AsyncSession = Depends(get_db)):
    repo = UserRepository(db)
    user = await repo.get_by_email(payload.email)
    if not user or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid credentials")
    if not user.is_active:
        raise HTTPException(403, "Account deactivated")
    return TokenResponse(
        access_token=create_access_token(str(user.id)),
        refresh_token=create_refresh_token(str(user.id)),
    )


@router.post("/refresh", response_model=TokenResponse)
async def refresh(payload: RefreshRequest, db: AsyncSession = Depends(get_db)):
    data = decode_token(payload.refresh_token)
    if not data or data.get("type") != "refresh":
        raise HTTPException(401, "Invalid refresh token")
    import uuid
    repo = UserRepository(db)
    user = await repo.get_by_id(uuid.UUID(data["sub"]))
    if not user:
        raise HTTPException(401, "User not found")
    return TokenResponse(
        access_token=create_access_token(str(user.id)),
        refresh_token=create_refresh_token(str(user.id)),
    )
