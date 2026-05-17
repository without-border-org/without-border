# Keycloak Integration Guide

This document describes the integration of Keycloak as the authentication provider for WithoutBorder.

## Overview

WithoutBorder now uses **Keycloak** (https://auth.manga-pics.com) for centralized authentication and user management instead of the legacy internal JWT system.

### Key Changes

- **Backend**: Validates RS256 tokens from Keycloak via JWKS, performs lazy-sync of users
- **Frontend**: Uses keycloak-angular for OIDC Auth Code + PKCE flow
- **Database**: Minimal user mirror (id, email, username, language, status, agentic fields)
- **Passwords**: Managed by Keycloak, NOT stored locally

## Configuration

### Backend

#### Environment Variables

```bash
# Keycloak / OIDC
KEYCLOAK_URL=https://auth.manga-pics.com
KEYCLOAK_REALM=without-border
KEYCLOAK_AUDIENCE=without-border-frontend
KEYCLOAK_VERIFY_AUD=true
KEYCLOAK_JWKS_CACHE_TTL=3600

# Auth bypass (LOCAL DEV ONLY)
AUTH_DISABLED=false
AUTH_DISABLED_USER_ID=
```

#### Migration

Run Alembic migration to drop `hashed_password` column:

```bash
cd backend
alembic upgrade head
python -m app.seed  # Creates demo users from fixed UUIDs
```

### Frontend

#### Environment Configuration

File: `frontend/src/environments/environment.ts`

```typescript
export const environment = {
  production: false,
  apiUrl: 'http://localhost:8000',
  authDisabled: false,
  keycloak: {
    url: 'https://auth.manga-pics.com',
    realm: 'without-border',
    clientId: 'without-border-frontend',
  },
};
```

#### Required Asset

Create `frontend/src/assets/silent-check-sso.html`:

```html
<!DOCTYPE html>
<html>
<body>
<script>
  parent.postMessage(location.href, location.origin);
</script>
</body>
</html>
```

## Two Authentication Modes

### Mode 1: Keycloak Enabled (Production)

Default mode. Users authenticate via Keycloak:

1. User clicks "Login" → redirects to Keycloak
2. Keycloak login → callback with authorization code
3. Frontend exchanges code for tokens (handled by keycloak-angular)
4. Frontend sends access token to backend in Authorization header
5. Backend validates token via JWKS, lazy-syncs user

**Start locally:**
```bash
AUTH_DISABLED=false ./start.sh
```

**Demo accounts** (in Keycloak):
- user@without-border.ca / (check Keycloak)
- admin@without-border.ca / (check Keycloak)
- superadmin@without-border.ca / (check Keycloak)

### Mode 2: AUTH_DISABLED (Local Dev Only)

Bypasses Keycloak entirely. Useful for offline development/demo.

**Start locally:**
```bash
AUTH_DISABLED=true ./start.sh
```

Then:
- Backend: No token validation, returns first active user
- Frontend: No Keycloak redirect, direct API access
- App is fully functional without network access

**Warning**: Never enable in production!

## Implementation Details

### Backend Token Validation

File: `backend/app/core/security/keycloak.py`

- Fetches JWKS from `/realms/without-border/protocol/openid-connect/certs`
- Caches keys with TTL (default 3600s)
- Validates RS256 signature, issuer, audience, expiration
- Handles key rotation automatically

### Lazy-Sync User Creation

File: `backend/app/services/keycloak_sync_service.py`

On first authenticated request:
1. Extract claims from token (sub, email, preferred_username, locale, enabled)
2. Look up local user by `id` (= Keycloak `sub`)
3. If exists: update soft fields (email, username, enabled status)
4. If new: create user with defaults (status=active, agentic=false, is_active=true)

### Frontend Auth Flow

1. **Initialization** (`app.config.ts`): Calls `KeycloakService.init()` with PKCE
2. **Login** (`AuthService.login()`): Redirects to Keycloak
3. **Interceptor** (`keycloak-bearer.interceptor.ts`): Injects token into API requests
4. **Guard** (`auth.guard.ts`): Protects routes, redirects to login if needed
5. **Logout** (`AuthService.logout()`): Calls Keycloak logout endpoint

## Endpoints Changed

### Removed
- `POST /api/v1/auth/register` (now managed by Keycloak)
- `POST /api/v1/auth/login` (now managed by Keycloak)
- `POST /api/v1/auth/refresh` (now automatic via keycloak-angular)

### Modified
- `PUT /api/v1/users/me`: No longer accepts email/username (Keycloak manages)
- WebSocket `/ws/channels/{id}`: Token validation changed to Keycloak RS256

### Unchanged
- `GET /api/v1/users/me`
- `GET /api/v1/users/search`
- `PUT /api/v1/users/me/status`
- `POST /api/v1/users/me/avatar`

## Testing

### Backend Tests

```bash
cd backend
pip install pytest pytest-asyncio
pytest tests/test_keycloak.py -v
```

Tests cover:
- JWKS cache behavior
- Token validation (valid, expired, invalid sig, wrong aud/iss)
- Lazy-sync (create, update, idempotence)
- AUTH_DISABLED mode

### Frontend Tests

```bash
cd frontend
npm test
```

Tests cover:
- Guard with AUTH_DISABLED
- Interceptor token injection
- AuthService.loadCurrentUser()

### End-to-End

1. **Keycloak mode:**
   ```bash
   docker compose up -d
   # Open http://localhost:4200
   # Click Login → Keycloak → Callback → App
   ```

2. **AUTH_DISABLED mode:**
   ```bash
   AUTH_DISABLED=true docker compose up -d
   # Open http://localhost:4200
   # App is immediately accessible (no login needed)
   ```

## Troubleshooting

### "Token missing 'kid'" or JWKS errors

- Check `KEYCLOAK_URL` is correct
- Verify Keycloak realm exists and is accessible
- Check CORS if running locally

### "Invalid audience" errors

- Verify `KEYCLOAK_AUDIENCE` matches client ID in Keycloak
- Check token contains correct `aud` claim
- If testing with different audience, set `KEYCLOAK_VERIFY_AUD=false` (dev only)

### WebSocket connect fails

- Token must be passed in query string: `ws://localhost:8000/api/v1/ws/channels/{id}?token={jwt}`
- Token must be valid Keycloak access token (or bypass mode must be enabled)

### "User not found or inactive" (after login)

- Check that user exists in local DB (should be created by lazy-sync)
- Run seed: `python -m app.seed`
- Check `AUTH_DISABLED_USER_ID` if using bypass mode

## Migration from Legacy Auth

For projects currently using the legacy internal JWT auth:

1. **Backup DB**: Save current user data if needed
2. **Run Alembic**: `alembic upgrade head` (drops hashed_password)
3. **Update .env**: Add KEYCLOAK_* variables
4. **Run seed**: `python -m app.seed` (creates Keycloak-synced users)
5. **Test**: Both AUTH_DISABLED and Keycloak modes
6. **Deploy**: Update frontend environment.ts before deploying

## References

- [Keycloak Admin Console](https://auth.manga-pics.com/admin)
- [Keycloak Realm Config](../../digitia-keycloack/realm/without-border-prod-realm.json)
- [keycloak-angular Docs](https://www.keycloak.org/docs/latest/securing_apps/index.html#_javascript_adapter)
- Plan: [../../docs/wb-1-plan-keycloak.md](../../docs/wb-1-plan-keycloak.md)
