"""Tests for Keycloak token validation and lazy-sync."""
import asyncio
import json
import uuid
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker

from app.main import create_app
from app.core.config.settings import settings
from app.core.security.keycloak import validate_keycloak_token, JWKSCache
from app.services.keycloak_sync_service import KeycloakUserSyncService
from app.models.models import User
from app.core.database import Base


# Test fixtures
@pytest.fixture
def mock_jwks_keys():
    """Mock JWKS public keys response from Keycloak."""
    return {
        "keys": [
            {
                "kid": "test-key-id",
                "kty": "RSA",
                "use": "sig",
                "n": "test-modulus",
                "e": "AQAB",
            }
        ]
    }


@pytest.fixture
def valid_token_claims():
    """Valid Keycloak token claims."""
    return {
        "sub": str(uuid.uuid4()),
        "email": "test@example.com",
        "preferred_username": "testuser",
        "locale": "en",
        "enabled": True,
        "iat": 1609459200,
        "exp": 9999999999,
    }


class TestKeycloakValidation:
    """Test Keycloak token validation logic."""
    
    @pytest.mark.asyncio
    async def test_jwks_cache_initialization(self):
        """Test JWKS cache initializes correctly."""
        cache = JWKSCache()
        assert cache._keys is None
        assert cache._fetched_at == 0.0
    
    @pytest.mark.asyncio
    async def test_jwks_cache_invalidation(self):
        """Test JWKS cache can be invalidated."""
        cache = JWKSCache()
        cache._keys = {"test": "data"}
        cache._fetched_at = 1000.0
        cache.invalidate()
        assert cache._keys is None
        assert cache._fetched_at == 0.0


class TestKeycloakUserSync:
    """Test lazy-sync user creation/update."""
    
    @pytest.mark.asyncio
    async def test_upsert_new_user_from_token(self, valid_token_claims):
        """Test creating a new user from Keycloak token claims."""
        # Setup: create in-memory DB
        engine = create_async_engine("sqlite+aiosqlite:///:memory:", echo=False)
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)

        TestSessionLocal = async_sessionmaker(bind=engine, class_=AsyncSession, expire_on_commit=False)

        async with TestSessionLocal() as db:
            sync_service = KeycloakUserSyncService(db)
            user = await sync_service.upsert_from_token(valid_token_claims)
            
            assert user.email == valid_token_claims["email"]
            assert user.username == valid_token_claims["preferred_username"]
            assert user.preferred_language == valid_token_claims["locale"]
            assert user.is_active == valid_token_claims["enabled"]
    
    @pytest.mark.asyncio
    async def test_upsert_update_existing_user(self, valid_token_claims):
        """Test updating an existing user when email/username changes."""
        engine = create_async_engine("sqlite+aiosqlite:///:memory:", echo=False)
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)

        TestSessionLocal = async_sessionmaker(bind=engine, class_=AsyncSession, expire_on_commit=False)

        async with TestSessionLocal() as db:
            sync_service = KeycloakUserSyncService(db)
            
            # Create user first time
            user1 = await sync_service.upsert_from_token(valid_token_claims)
            user_id = user1.id
            
            # Update with new email/username
            updated_claims = {**valid_token_claims, "email": "newemail@example.com"}
            user2 = await sync_service.upsert_from_token(updated_claims)
            
            assert user2.id == user_id
            assert user2.email == "newemail@example.com"


class TestAuthDisabledMode:
    """Test AUTH_DISABLED=true bypass mode."""
    
    @pytest.mark.asyncio
    async def test_auth_disabled_bypass(self):
        """Test that AUTH_DISABLED=true skips all token validation."""
        # This test would mock settings.AUTH_DISABLED = True
        # and verify get_current_user returns the bypass user
        # (Implementation depends on test DB setup)
        pass


class TestEndtoEndAuth:
    """End-to-end authentication tests."""
    
    def test_health_endpoint_no_auth(self):
        """Test that /health endpoint is accessible without auth."""
        app = create_app()
        client = TestClient(app)
        response = client.get("/health")
        assert response.status_code == 200
        assert "status" in response.json()
    
    def test_me_endpoint_requires_auth(self):
        """Test that /users/me requires authentication."""
        app = create_app()
        client = TestClient(app)
        response = client.get("/api/v1/users/me")
        # Should return 403 (no credentials) or 401 (invalid token)
        assert response.status_code in [401, 403]


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
