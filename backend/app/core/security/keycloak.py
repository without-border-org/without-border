"""Keycloak token validation via JWKS (RS256).

This module handles:
- JWKS caching with TTL to avoid repeated HTTP calls
- RS256 token verification using Keycloak's public keys
- Token expiration and signature validation
- WebSocket authentication helper
"""
import time
import httpx
from jose import jwt, JWTError
from jose.exceptions import ExpiredSignatureError
from fastapi import HTTPException, status, WebSocket

from app.core.config.settings import settings


class JWKSCache:
    """Cache des clés publiques Keycloak avec TTL.
    
    Attributes:
        _keys: Cached JWKS data
        _fetched_at: Timestamp of last fetch
    """
    
    def __init__(self):
        self._keys: dict | None = None
        self._fetched_at: float = 0.0

    async def get_keys(self) -> dict:
        """Retrieve JWKS, using cache if still valid.
        
        Raises:
            HTTPException: If JWKS fetch fails
        """
        now = time.time()
        if self._keys and (now - self._fetched_at) < settings.KEYCLOAK_JWKS_CACHE_TTL:
            return self._keys
        
        async with httpx.AsyncClient(timeout=5.0) as client:
            try:
                r = await client.get(settings.keycloak_jwks_url)
                r.raise_for_status()
                self._keys = r.json()
                self._fetched_at = now
            except httpx.HTTPError as e:
                raise HTTPException(
                    status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                    detail=f"Failed to fetch Keycloak JWKS: {str(e)}"
                )
        return self._keys

    def invalidate(self):
        """Invalidate cache (used after key rotation detection)."""
        self._keys = None
        self._fetched_at = 0.0


_jwks_cache = JWKSCache()


async def validate_keycloak_token(token: str) -> dict:
    """Validate a Keycloak access token and return claims.
    
    Validates:
    - Token structure and signature (RS256)
    - Issuer (iss claim matches Keycloak)
    - Audience (aud claim if KEYCLOAK_VERIFY_AUD=true)
    - Token expiration (exp claim)
    
    Args:
        token: Bearer token string (without "Bearer " prefix)
        
    Returns:
        Dictionary of JWT claims (sub, email, preferred_username, etc.)
        
    Raises:
        HTTPException(401): Token invalid/expired/malformed
        HTTPException(503): Keycloak JWKS unreachable
    """
    try:
        unverified_header = jwt.get_unverified_header(token)
    except JWTError:
        raise HTTPException(status_code=401, detail="Malformed token")

    kid = unverified_header.get("kid")
    if not kid:
        raise HTTPException(status_code=401, detail="Token missing 'kid' header")

    jwks = await _jwks_cache.get_keys()
    key = next((k for k in jwks["keys"] if k["kid"] == kid), None)
    
    if not key:
        # Possible key rotation: invalidate cache and retry once
        _jwks_cache.invalidate()
        jwks = await _jwks_cache.get_keys()
        key = next((k for k in jwks["keys"] if k["kid"] == kid), None)
        if not key:
            raise HTTPException(status_code=401, detail="Unknown signing key")

    try:
        claims = jwt.decode(
            token,
            key,
            algorithms=["RS256"],
            audience=settings.KEYCLOAK_AUDIENCE if settings.KEYCLOAK_VERIFY_AUD else None,
            issuer=settings.keycloak_issuer,
            options={"verify_aud": settings.KEYCLOAK_VERIFY_AUD},
        )
    except ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except JWTError as e:
        raise HTTPException(status_code=401, detail=f"Invalid token: {str(e)}")

    return claims


async def authenticate_websocket(websocket: WebSocket) -> dict:
    """Authenticate WebSocket connection via Keycloak token.
    
    Extracts token from query parameter 'token' and validates it.
    Closes WebSocket with code 4401 if auth fails.
    
    Args:
        websocket: FastAPI WebSocket connection
        
    Returns:
        JWT claims dictionary
        
    Raises:
        RuntimeError: If token is missing or invalid (WebSocket closed)
    """
    if settings.AUTH_DISABLED:
        # Return a minimal claims dict for bypass mode — honour AUTH_DISABLED_USER_ID if set
        bypass_sub = settings.AUTH_DISABLED_USER_ID or "00000000-0000-0000-0000-000000000001"
        return {"sub": bypass_sub, "email": "bypass@test.local"}
    
    token = websocket.query_params.get("token")
    if not token:
        await websocket.close(code=4401, reason="Missing token")
        raise RuntimeError("WebSocket auth failed: missing token")
    
    try:
        claims = await validate_keycloak_token(token)
        return claims
    except HTTPException:
        await websocket.close(code=4401, reason="Invalid token")
        raise RuntimeError("WebSocket auth failed: invalid token")
