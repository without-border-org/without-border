# WB-1 — Plan : Délégation Auth & Gestion Utilisateurs à Keycloak

## Sommaire
- [1. Contexte et objectifs](#1-contexte-et-objectifs)
  - [1.1 Pourquoi Keycloak](#11-pourquoi-keycloak)
  - [1.2 Périmètre](#12-périmètre)
  - [1.3 Hors périmètre](#13-hors-périmètre)
- [2. État actuel du projet](#2-état-actuel-du-projet)
  - [2.1 Backend](#21-backend)
  - [2.2 Frontend](#22-frontend)
  - [2.3 Base de données](#23-base-de-données)
- [3. Architecture cible](#3-architecture-cible)
  - [3.1 Vue d'ensemble](#31-vue-densemble)
  - [3.2 Flux Auth Code + PKCE](#32-flux-auth-code--pkce)
  - [3.3 Modèle utilisateur cible](#33-modèle-utilisateur-cible)
- [4. Configuration Keycloak](#4-configuration-keycloak)
  - [4.1 Realm](#41-realm)
  - [4.2 Client frontend](#42-client-frontend)
  - [4.3 Client backend (optionnel)](#43-client-backend-optionnel)
  - [4.4 Rôles et claims](#44-rôles-et-claims)
  - [4.5 Attributs utilisateurs custom](#45-attributs-utilisateurs-custom)
- [5. Refactoring backend](#5-refactoring-backend)
  - [5.1 Nouvelles dépendances](#51-nouvelles-dépendances)
  - [5.2 Variables d'environnement](#52-variables-denvironnement)
  - [5.3 Validation JWT via JWKS](#53-validation-jwt-via-jwks)
  - [5.4 Lazy-sync des utilisateurs](#54-lazy-sync-des-utilisateurs)
  - [5.5 Refonte de get_current_user](#55-refonte-de-get_current_user)
  - [5.6 Mode AUTH_DISABLED](#56-mode-auth_disabled)
  - [5.7 Endpoints supprimés](#57-endpoints-supprimés)
  - [5.8 Endpoints adaptés](#58-endpoints-adaptés)
  - [5.9 WebSocket](#59-websocket)
  - [5.10 Modèle ORM User](#510-modèle-orm-user)
  - [5.11 Migration Alembic](#511-migration-alembic)
- [6. Refactoring frontend Angular](#6-refactoring-frontend-angular)
  - [6.1 Nouvelles dépendances](#61-nouvelles-dépendances)
  - [6.2 Variables d'environnement](#62-variables-denvironnement)
  - [6.3 Initialisation keycloak-angular](#63-initialisation-keycloak-angular)
  - [6.4 Service auth](#64-service-auth)
  - [6.5 Intercepteur](#65-intercepteur)
  - [6.6 Guards](#66-guards)
  - [6.7 Pages à supprimer](#67-pages-à-supprimer)
  - [6.8 Mode AUTH_DISABLED frontend](#68-mode-auth_disabled-frontend)
- [7. Seed et migration des données](#7-seed-et-migration-des-données)
- [8. Docker compose](#8-docker-compose)
- [9. Tests](#9-tests)
- [10. Critères d'acceptation](#10-critères-dacceptation)
- [11. Vérification end-to-end](#11-vérification-end-to-end)
- [12. Ordre d'exécution recommandé](#12-ordre-dexécution-recommandé)

---

## 1. Contexte et objectifs

### 1.1 Pourquoi Keycloak

Le projet **without-border** gère aujourd'hui en interne :
- Le hash bcrypt des mots de passe (`backend/app/core/security/password_handler.py`)
- L'émission/validation de JWT HS256 (`backend/app/core/security/jwt_handler.py`)
- Les endpoints `register/login/refresh` (`backend/app/api/v1/endpoints/auth_router.py`)
- Une table `users` qui contient `email`, `username`, `hashed_password`, etc.

L'objectif est de **déléguer 100 % de l'authentification et de la gestion d'identité** à une instance **Keycloak existante**, dans un realm dédié `without-border` à créer.

La plateforme **ne stocke plus que le strict minimum d'information utilisateur** nécessaire au métier : préférence de langue, statut agentic, persona, avatar. L'identifiant local est **le `sub` Keycloak** (UUID).

### 1.2 Périmètre

- Création du realm Keycloak `without-border` + clients OIDC.
- Backend FastAPI : validation des access tokens Keycloak via JWKS (RS256).
- Backend FastAPI : suppression des endpoints d'auth interne.
- Backend FastAPI : lazy-sync d'un mirror local minimal au premier appel d'un user authentifié.
- Frontend Angular : intégration `keycloak-angular` avec Auth Code + PKCE.
- Frontend Angular : suppression des pages login/register.
- Mode `AUTH_DISABLED` : flag global qui désactive l'authentification **sur le front ET le back** simultanément. Aucune redirection, aucun token, accès libre.

### 1.3 Hors périmètre

- Provisioning automatique d'utilisateurs en bulk (out of scope pour cette itération).
- Federation LDAP/SAML avec Keycloak (à configurer manuellement dans Keycloak si besoin).
- Forgot-password / email verification (gérés nativement par Keycloak — aucune intégration côté app).
- MFA (configuration native Keycloak).
- Webhook Keycloak pour sync temps réel (lazy-sync suffit).

---

## 2. État actuel du projet

### 2.1 Backend

Stack : **FastAPI 0.115.5**, **SQLAlchemy 2.0.36 async**, **PostgreSQL 16**, Pydantic v2, `python-jose`, `passlib[bcrypt]`.

Fichiers concernés :

| Fichier | Rôle |
|---|---|
| `backend/app/models/models.py` | Modèle ORM `User` (lignes 11-32) |
| `backend/app/api/v1/endpoints/auth_router.py` | `POST /auth/register`, `/auth/login`, `/auth/refresh` |
| `backend/app/api/v1/endpoints/users_router.py` | `GET /users/me`, `PUT /users/me`, status, avatar, search, notifications |
| `backend/app/core/security/jwt_handler.py` | `create_access_token`, `decode_token`, `get_current_user`, mode `AUTH_DISABLED` |
| `backend/app/core/security/password_handler.py` | `hash_password`, `verify_password` |
| `backend/app/core/config/settings.py` | `SECRET_KEY`, `ALGORITHM`, `AUTH_DISABLED`, `AUTH_DISABLED_USER_ID` |
| `backend/app/repositories/repositories.py` | `UserRepository` |
| `backend/app/schemas/schemas.py` | `UserRead`, `UserCreate`, `LoginRequest`, `TokenResponse` |
| `backend/app/main.py` | Wiring routers |
| `backend/app/scripts/seed.py` | Seed users avec bcrypt |
| `backend/.env.example` | Variables actuelles |

Caractéristiques :
- JWT HS256 signé par `SECRET_KEY`.
- `get_current_user` (`jwt_handler.py:57-84`) lit le header `Authorization: Bearer ...`, décode, charge le user en DB.
- Mode `AUTH_DISABLED=true` (`jwt_handler.py:35-54`) : retourne le premier user actif ou `AUTH_DISABLED_USER_ID`. Toute requête est traitée comme cet utilisateur.
- WebSocket `/ws/channels/{id}` (`messages_router.py`) : auth actuellement basée sur le token passé en query string.

### 2.2 Frontend

Stack : **Angular 21**, RxJS, Tailwind CSS 3.4, Signals.

Fichiers concernés :

| Fichier | Rôle |
|---|---|
| `frontend/src/app/core/services/auth.service.ts` | `_user` signal, `login()`, `register()`, `refresh()`, `logout()`, localStorage `wb_at`/`wb_rt` |
| `frontend/src/app/core/interceptors/jwt.interceptor.ts` | Injection `Authorization`, retry sur 401 |
| `frontend/src/app/core/guards/auth.guard.ts` | Vérifie `auth.hasToken()` |
| `frontend/src/app/core/guards/guest.guard.ts` | Inverse de auth.guard |
| `frontend/src/app/features/auth/login/login.component.ts` | Formulaire login |
| `frontend/src/app/features/auth/register/register.component.ts` | Formulaire register |
| `frontend/src/app/app.routes.ts` | Routes `/auth` (guest), `/chat` & `/profile` (authGuard) |
| `frontend/src/app/core/models/index.ts` | Type `User`, `AuthTokens` |
| `frontend/src/environments/environment.ts` | `apiUrl: 'http://localhost:8000'` |
| `frontend/package.json` | Aucune lib OIDC |

### 2.3 Base de données

Schéma actuel :
- Table `users` : `id` UUID, `email` UNIQUE, `username` UNIQUE, `hashed_password`, `preferred_language`, `status` enum, `agentic_enabled`, `agentic_persona`, `avatar_url`, `is_active`, `created_at`, `updated_at`.
- Table `channel_members.user_id`, `messages.sender_id`, `message_reactions.user_id`, `notifications.user_id` → FK vers `users.id`.

Le dossier `backend/alembic/versions/` est **vide** (`.gitkeep` seulement). Aucune migration historisée. Le schéma est créé via `Base.metadata.create_all()` au démarrage (à confirmer dans `main.py`).

---

## 3. Architecture cible

### 3.1 Vue d'ensemble

```
┌─────────────┐         ┌──────────────┐         ┌──────────────┐
│             │         │              │         │              │
│  Angular    │  OIDC   │   Keycloak   │         │   FastAPI    │
│  (browser)  │◄───────►│   (realm     │         │   backend    │
│             │  PKCE   │ without-     │         │              │
│             │         │  border)     │         │              │
└──────┬──────┘         └──────────────┘         └──────┬───────┘
       │                       ▲                        │
       │   Bearer token        │      JWKS              │
       └──────────────────────►│◄───────────────────────┘
                               │
                          [validate signature
                          via JWKS, RS256]
```

- Le frontend obtient un access token JWT signé RS256 par Keycloak.
- Il l'envoie au backend dans le header `Authorization: Bearer ...`.
- Le backend récupère les clés publiques via JWKS (`{KC_URL}/realms/without-border/protocol/openid-connect/certs`) et vérifie la signature.
- Au premier appel d'un user, le backend crée son mirror local en DB.

### 3.2 Flux Auth Code + PKCE

1. User clique "Login" dans Angular → redirect vers `{KC_URL}/realms/without-border/protocol/openid-connect/auth?...&code_challenge=...&code_challenge_method=S256`.
2. Keycloak affiche son login form (ou SSO si déjà connecté).
3. Redirect callback vers Angular (`http://localhost:4200/*`) avec `?code=...`.
4. `keycloak-angular` échange le code contre les tokens via `/token` endpoint.
5. Le SDK gère le refresh automatique avant expiration.

### 3.3 Modèle utilisateur cible

**Table `users` minimale** (mirror local) :

| Colonne | Type | Source | Notes |
|---|---|---|---|
| `id` | UUID PK | Keycloak `sub` | Identique au sub Keycloak |
| `email` | varchar(255) | Keycloak `email` | Sync au login, indexé |
| `username` | varchar(100) | Keycloak `preferred_username` | Indexé |
| `preferred_language` | varchar(10) | Attribut custom Keycloak `locale` ou défaut `fr` | Modifiable côté app |
| `status` | enum | Champ métier app | `active`/`agentic`/`inactive` |
| `agentic_enabled` | bool | Champ métier app | |
| `agentic_persona` | text NULL | Champ métier app | |
| `avatar_url` | varchar(500) NULL | Champ métier app | Upload local |
| `is_active` | bool | Sync du `enabled` Keycloak | |
| `created_at` | timestamp | DB | |
| `updated_at` | timestamp | DB | |

**Supprimés** :
- `hashed_password` (Keycloak gère)

**Note** : `email` et `username` sont stockés pour permettre les jointures et la recherche **sans devoir interroger Keycloak Admin API** à chaque requête. Ils sont synchronisés au login (lazy-sync).

---

## 4. Configuration Keycloak

### 4.1 Realm

| Paramètre | Valeur |
|---|---|
| Realm name | `without-border` |
| Display name | `Without Border` |
| Login theme | `keycloak` (ou theme custom plus tard) |
| Token endpoint auth method | RS256 (default) |
| Access token lifespan | 5 min (default) |
| SSO session idle | 30 min |
| SSO session max | 10 h |

### 4.2 Client frontend

| Paramètre | Valeur |
|---|---|
| Client ID | `wb-frontend` |
| Client type | OpenID Connect |
| Access type | **Public** |
| Authentication flow | Standard flow (Auth Code) |
| PKCE Code Challenge Method | `S256` |
| Valid redirect URIs | `http://localhost:4200/*`, `https://wb.exemple.com/*` |
| Web origins | `http://localhost:4200`, `https://wb.exemple.com` |
| Front-channel logout | enabled |
| Post-logout redirect URIs | `http://localhost:4200/*` |

### 4.3 Client backend (optionnel)

Uniquement si on veut un client confidentiel pour appeler l'Admin API depuis le backend (par ex pour sync les `enabled`).

| Paramètre | Valeur |
|---|---|
| Client ID | `wb-backend` |
| Access type | **Confidential** |
| Service accounts enabled | true |
| Client secret | (généré, stocké en env) |

### 4.4 Rôles et claims

Pour cette itération, **pas de gestion de rôles globaux côté Keycloak**. Les rôles métier (admin de channel, member) restent dans la table `channel_members.role`.

Claims attendus dans l'access token :
- `sub` (UUID, identifiant local)
- `email`
- `email_verified`
- `preferred_username`
- `locale` (optionnel — sinon défaut `fr` côté backend)
- `iat`, `exp`, `iss`, `aud`

### 4.5 Attributs utilisateurs custom

Ajouter un attribut custom optionnel :
- `locale` (string) : code langue préféré (`fr`, `en`, `es`, etc.). Mappé en claim via "User Attribute mapper" → "Token Claim Name: `locale`".

---

## 5. Refactoring backend

### 5.1 Nouvelles dépendances

`backend/requirements.txt` — additions :

```
# Keycloak / OIDC
python-keycloak==4.0.0       # optionnel — pour Admin API et JWKS
# httpx déjà présent (0.28.1)
# python-jose[cryptography] déjà présent
```

À supprimer :
- `passlib[bcrypt]` (plus nécessaire) — **garder** si d'autres usages, sinon retirer.

### 5.2 Variables d'environnement

`backend/.env.example` — additions :

```bash
# ── Keycloak ─────────────────────────────────────────────────────────────
KEYCLOAK_URL=https://keycloak.exemple.com
KEYCLOAK_REALM=without-border
KEYCLOAK_AUDIENCE=wb-frontend         # ou liste séparée par virgules
KEYCLOAK_VERIFY_AUD=true              # peut être false en dev
KEYCLOAK_JWKS_CACHE_TTL=3600          # secondes

# ── Auth bypass (LOCAL DEV ONLY) ─────────────────────────────────────────
AUTH_DISABLED=false
AUTH_DISABLED_USER_ID=
```

À supprimer (ne plus utiliser) :
- `SECRET_KEY` (plus de JWT HS256 émis localement)
- `ALGORITHM`
- `ACCESS_TOKEN_EXPIRE_MINUTES`
- `REFRESH_TOKEN_EXPIRE_DAYS`

`backend/app/core/config/settings.py` — réécriture de la section auth :

```python
class Settings(BaseSettings):
    # ...
    # ── Keycloak ─────────────────────────────────────────
    KEYCLOAK_URL: str = ""
    KEYCLOAK_REALM: str = "without-border"
    KEYCLOAK_AUDIENCE: str = "wb-frontend"
    KEYCLOAK_VERIFY_AUD: bool = True
    KEYCLOAK_JWKS_CACHE_TTL: int = 3600

    # ── Auth bypass ──────────────────────────────────────
    AUTH_DISABLED: bool = False
    AUTH_DISABLED_USER_ID: str = ""

    @property
    def keycloak_issuer(self) -> str:
        return f"{self.KEYCLOAK_URL.rstrip('/')}/realms/{self.KEYCLOAK_REALM}"

    @property
    def keycloak_jwks_url(self) -> str:
        return f"{self.keycloak_issuer}/protocol/openid-connect/certs"
```

### 5.3 Validation JWT via JWKS

Nouveau fichier `backend/app/core/security/keycloak.py` :

```python
"""Keycloak token validation via JWKS."""
import time
import httpx
from jose import jwt, JWTError
from jose.exceptions import ExpiredSignatureError
from fastapi import HTTPException, status
from app.core.config.settings import settings


class JWKSCache:
    """Cache des clés publiques Keycloak avec TTL."""
    def __init__(self):
        self._keys: dict | None = None
        self._fetched_at: float = 0.0

    async def get_keys(self) -> dict:
        now = time.time()
        if self._keys and (now - self._fetched_at) < settings.KEYCLOAK_JWKS_CACHE_TTL:
            return self._keys
        async with httpx.AsyncClient(timeout=5.0) as client:
            r = await client.get(settings.keycloak_jwks_url)
            r.raise_for_status()
            self._keys = r.json()
            self._fetched_at = now
        return self._keys

    def invalidate(self):
        self._keys = None
        self._fetched_at = 0.0


_jwks_cache = JWKSCache()


async def validate_keycloak_token(token: str) -> dict:
    """Valide un access token Keycloak. Retourne les claims.

    Raise HTTPException(401) si invalide.
    """
    try:
        unverified_header = jwt.get_unverified_header(token)
    except JWTError:
        raise HTTPException(status_code=401, detail="Malformed token")

    kid = unverified_header.get("kid")
    if not kid:
        raise HTTPException(status_code=401, detail="Token missing 'kid'")

    jwks = await _jwks_cache.get_keys()
    key = next((k for k in jwks["keys"] if k["kid"] == kid), None)
    if not key:
        # Possible rotation : invalider et réessayer une fois
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
        raise HTTPException(status_code=401, detail=f"Invalid token: {e}")

    return claims
```

### 5.4 Lazy-sync des utilisateurs

Nouveau fichier `backend/app/services/keycloak_sync_service.py` :

```python
"""Lazy-sync : crée ou met à jour le mirror local au premier appel d'un user."""
import uuid
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.models import User
from app.repositories.repositories import UserRepository
from app.schemas.schemas import UserRead


class KeycloakUserSyncService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.repo = UserRepository(db)

    async def upsert_from_token(self, claims: dict) -> UserRead:
        """Crée ou met à jour le user local à partir des claims Keycloak."""
        sub = claims.get("sub")
        if not sub:
            raise ValueError("Token missing 'sub'")

        user_id = uuid.UUID(sub)
        email = claims.get("email", "")
        username = claims.get("preferred_username", email)
        locale = claims.get("locale", "fr")

        existing = await self.repo.get_by_id(user_id)
        if existing:
            # Mise à jour soft des champs synchronisés
            changed = False
            if existing.email != email:
                existing.email = email
                changed = True
            if existing.username != username:
                existing.username = username
                changed = True
            if changed:
                await self.db.commit()
                await self.db.refresh(existing)
            return UserRead.model_validate(existing)

        # Création
        new_user = User(
            id=user_id,
            email=email,
            username=username,
            preferred_language=locale,
            status="active",
            agentic_enabled=False,
            is_active=True,
        )
        self.db.add(new_user)
        await self.db.commit()
        await self.db.refresh(new_user)
        return UserRead.model_validate(new_user)
```

### 5.5 Refonte de get_current_user

Réécrire `backend/app/core/security/jwt_handler.py` (renommer en `auth_handler.py` pour clarté, mais conserver l'ancien nom pour limiter les imports cassés) :

```python
"""FastAPI auth dependency — Keycloak + AUTH_DISABLED bypass."""
import uuid
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from app.core.config.settings import settings
from app.core.security.keycloak import validate_keycloak_token

security = HTTPBearer(auto_error=False)


async def _get_bypass_user():
    """AUTH_DISABLED=true → retourne le premier user actif ou AUTH_DISABLED_USER_ID."""
    from app.schemas.schemas import UserRead
    from app.core.database import AsyncSessionLocal
    from app.repositories.repositories import UserRepository
    from sqlalchemy import select
    from app.models.models import User

    async with AsyncSessionLocal() as db:
        repo = UserRepository(db)
        if settings.AUTH_DISABLED_USER_ID:
            user = await repo.get_by_id(uuid.UUID(settings.AUTH_DISABLED_USER_ID))
        else:
            result = await db.execute(select(User).where(User.is_active == True).limit(1))
            user = result.scalar_one_or_none()
        if not user:
            raise HTTPException(status_code=503, detail="AUTH_DISABLED is on but no user in DB — run seed first")
        return UserRead.model_validate(user)


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
):
    """Auth dependency — valide le token Keycloak et lazy-sync le user local."""
    if settings.AUTH_DISABLED:
        return await _get_bypass_user()

    if not credentials:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")

    claims = await validate_keycloak_token(credentials.credentials)

    # Lazy-sync
    from app.core.database import AsyncSessionLocal
    from app.services.keycloak_sync_service import KeycloakUserSyncService
    async with AsyncSessionLocal() as db:
        return await KeycloakUserSyncService(db).upsert_from_token(claims)
```

### 5.6 Mode AUTH_DISABLED

**Comportement attendu** :
- `AUTH_DISABLED=true` (env) → `get_current_user` ne valide aucun token, retourne toujours le premier user actif (ou `AUTH_DISABLED_USER_ID`).
- Le frontend doit aussi être en mode bypass (voir §6.8). Sinon, le front demande un login Keycloak qui échoue.
- **Production** : ce flag doit être à `false`. Documenter en commentaire dans `.env.example`.

### 5.7 Endpoints supprimés

Dans `backend/app/api/v1/endpoints/auth_router.py` :

- `POST /api/v1/auth/register` → supprimé
- `POST /api/v1/auth/login` → supprimé
- `POST /api/v1/auth/refresh` → supprimé

Le fichier entier peut être supprimé. Retirer son import dans `backend/app/main.py` (ou `app/api/v1/router.py` selon où le wiring est fait).

Schémas à supprimer dans `backend/app/schemas/schemas.py` : `LoginRequest`, `RefreshRequest`, `TokenResponse`, `RegisterRequest` (vérifier les noms exacts).

### 5.8 Endpoints adaptés

`backend/app/api/v1/endpoints/users_router.py` :

| Endpoint | Action |
|---|---|
| `GET /users/me` | Conservé tel quel (retourne `UserRead`). Le user est créé en lazy-sync au passage par `get_current_user`. |
| `PUT /users/me` | **Supprimer la mise à jour de `email` et `username`** (gérée dans Keycloak). Ne reste que `preferred_language`, `agentic_enabled`, `agentic_persona`. |
| `PUT /users/me/status` | Conservé. |
| `POST /users/me/avatar` | Conservé. |
| `GET /users/search` | Conservé (recherche par username/email dans le mirror local). |
| `GET /users/me/notifications` | Conservé. |
| `PUT /users/me/notifications/read-all` | Conservé. |

Adapter le `UserUpdate` schéma en conséquence (retirer `email`, `username`, `password`).

### 5.9 WebSocket

Fichier : `backend/app/api/v1/endpoints/messages_router.py` — endpoint `WebSocket /ws/channels/{id}`.

Aujourd'hui le WebSocket reçoit un token JWT en query string. Il faut :
1. Extraire le token de la query (`websocket.query_params.get("token")`).
2. Si `AUTH_DISABLED=true` → bypass user.
3. Sinon → `validate_keycloak_token(token)` puis lazy-sync via `KeycloakUserSyncService`.
4. En cas d'échec → `await websocket.close(code=4401)`.

Helper à factoriser dans `backend/app/core/security/ws_auth.py` :

```python
async def authenticate_ws(websocket) -> UserRead:
    if settings.AUTH_DISABLED:
        return await _get_bypass_user()
    token = websocket.query_params.get("token")
    if not token:
        await websocket.close(code=4401, reason="Missing token")
        raise RuntimeError("ws auth failed")
    claims = await validate_keycloak_token(token)
    async with AsyncSessionLocal() as db:
        return await KeycloakUserSyncService(db).upsert_from_token(claims)
```

### 5.10 Modèle ORM User

`backend/app/models/models.py` — modifier la classe `User` :

**Avant** (lignes 11-32) :
```python
class User(Base):
    __tablename__ = "users"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    username: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)  # ← À SUPPRIMER
    preferred_language: Mapped[str] = mapped_column(String(10), default="fr", nullable=False)
    status: Mapped[str] = mapped_column(...)
    agentic_enabled: Mapped[bool] = mapped_column(Boolean, default=False)
    agentic_persona: Mapped[str | None] = mapped_column(Text, nullable=True)
    avatar_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: ...
    updated_at: ...
    # relations inchangées
```

**Après** :
```python
class User(Base):
    __tablename__ = "users"
    # id reste UUID (= sub Keycloak), default=uuid.uuid4 utile pour les seeds locaux
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email: Mapped[str] = mapped_column(String(255), nullable=False, index=True)  # plus UNIQUE strict (Keycloak gère)
    username: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    # hashed_password supprimé
    preferred_language: Mapped[str] = mapped_column(String(10), default="fr", nullable=False)
    status: Mapped[str] = mapped_column(...)  # inchangé
    agentic_enabled: Mapped[bool] = mapped_column(Boolean, default=False)
    agentic_persona: Mapped[str | None] = mapped_column(Text, nullable=True)
    avatar_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: ...
    updated_at: ...
    # relations inchangées
```

**Note** : on retire `unique=True` sur email/username car Keycloak est la source de vérité. On garde un index pour la recherche.

### 5.11 Migration Alembic

Le dossier `backend/alembic/versions/` est vide. Il faut :

1. Vérifier que `backend/alembic.ini` et `backend/alembic/env.py` sont configurés (pointer sur `Base.metadata`).
2. **Geler le schéma actuel** comme migration initiale :
   ```bash
   cd backend
   alembic revision --autogenerate -m "initial schema"
   alembic upgrade head
   ```
3. Créer la migration de drop :
   ```bash
   alembic revision -m "drop_hashed_password_drop_unique_email_username"
   ```
4. Contenu de la migration :
   ```python
   def upgrade():
       op.drop_column("users", "hashed_password")
       op.drop_constraint("users_email_key", "users", type_="unique")
       op.drop_constraint("users_username_key", "users", type_="unique")
       op.create_index("ix_users_username", "users", ["username"])

   def downgrade():
       op.add_column("users", sa.Column("hashed_password", sa.String(255), nullable=False, server_default=""))
       op.create_unique_constraint("users_email_key", "users", ["email"])
       op.create_unique_constraint("users_username_key", "users", ["username"])
       op.drop_index("ix_users_username", "users")
   ```
5. Si le code utilise actuellement `Base.metadata.create_all()` au démarrage (vérifier `main.py`), basculer sur `alembic upgrade head` au démarrage du conteneur (script `entrypoint.sh`) ou au moins documenter le run manuel.

---

## 6. Refactoring frontend Angular

### 6.1 Nouvelles dépendances

```bash
cd frontend
npm i keycloak-angular keycloak-js
```

Versions visées (à confirmer au moment de l'install — keycloak-angular suit les versions Angular) :
- `keycloak-angular@^16.x` (compatible Angular 21)
- `keycloak-js@^25.x`

### 6.2 Variables d'environnement

`frontend/src/environments/environment.ts` :

```typescript
export const environment = {
  production: false,
  apiUrl: 'http://localhost:8000',
  authDisabled: false,
  keycloak: {
    url: 'https://keycloak.exemple.com',
    realm: 'without-border',
    clientId: 'wb-frontend',
  },
};
```

`frontend/src/environments/environment.prod.ts` : équivalent prod.

### 6.3 Initialisation keycloak-angular

`frontend/src/app/app.config.ts` (ou le fichier équivalent qui exporte `appConfig`) :

```typescript
import { ApplicationConfig, APP_INITIALIZER } from '@angular/core';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { KeycloakService, KeycloakAngularModule } from 'keycloak-angular';
import { environment } from '../environments/environment';
import { keycloakBearerInterceptor } from './core/interceptors/keycloak-bearer.interceptor';

function initializeKeycloak(keycloak: KeycloakService) {
  return () => {
    if (environment.authDisabled) {
      return Promise.resolve();
    }
    return keycloak.init({
      config: environment.keycloak,
      initOptions: {
        onLoad: 'check-sso',
        silentCheckSsoRedirectUri: window.location.origin + '/assets/silent-check-sso.html',
        pkceMethod: 'S256',
        checkLoginIframe: false,
      },
    });
  };
}

export const appConfig: ApplicationConfig = {
  providers: [
    KeycloakService,
    {
      provide: APP_INITIALIZER,
      useFactory: initializeKeycloak,
      deps: [KeycloakService],
      multi: true,
    },
    provideHttpClient(withInterceptors([keycloakBearerInterceptor])),
    // ... autres providers
  ],
};
```

Créer `frontend/src/assets/silent-check-sso.html` :

```html
<!DOCTYPE html>
<html><body>
<script>parent.postMessage(location.href, location.origin);</script>
</body></html>
```

### 6.4 Service auth

Réécrire `frontend/src/app/core/services/auth.service.ts` comme un wrapper de `KeycloakService` :

```typescript
import { Injectable, computed, inject, signal } from '@angular/core';
import { KeycloakService } from 'keycloak-angular';
import { environment } from '../../../environments/environment';
import { User } from '../models';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private kc = inject(KeycloakService);
  private http = inject(HttpClient);
  private _user = signal<User | null>(null);

  readonly user = this._user.asReadonly();
  readonly isLoggedIn = computed(() => !!this._user() || environment.authDisabled);

  async loadCurrentUser(): Promise<User | null> {
    if (environment.authDisabled) {
      const u = await firstValueFrom(this.http.get<User>(`${environment.apiUrl}/api/v1/users/me`));
      this._user.set(u);
      return u;
    }
    if (!(await this.kc.isLoggedIn())) return null;
    const u = await firstValueFrom(this.http.get<User>(`${environment.apiUrl}/api/v1/users/me`));
    this._user.set(u);
    return u;
  }

  login() {
    if (environment.authDisabled) return;
    this.kc.login({ redirectUri: window.location.origin });
  }

  logout() {
    this._user.set(null);
    if (environment.authDisabled) return;
    this.kc.logout(window.location.origin);
  }

  async getToken(): Promise<string | null> {
    if (environment.authDisabled) return null;
    return await this.kc.getToken();
  }
}
```

### 6.5 Intercepteur

Remplacer `frontend/src/app/core/interceptors/jwt.interceptor.ts` par `keycloak-bearer.interceptor.ts` :

```typescript
import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { KeycloakService } from 'keycloak-angular';
import { from, switchMap } from 'rxjs';
import { environment } from '../../../environments/environment';

export const keycloakBearerInterceptor: HttpInterceptorFn = (req, next) => {
  if (environment.authDisabled) {
    return next(req);
  }
  if (!req.url.startsWith(environment.apiUrl)) {
    return next(req);
  }
  const kc = inject(KeycloakService);
  return from(kc.getToken()).pipe(
    switchMap(token => {
      const cloned = token
        ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
        : req;
      return next(cloned);
    }),
  );
};
```

Suppression de la logique 401 + retry refresh : `keycloak-js` rafraîchit automatiquement les tokens (paramètre `updateToken` appelé en interne par `getToken()`).

### 6.6 Guards

Réécrire `frontend/src/app/core/guards/auth.guard.ts` :

```typescript
import { CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';
import { KeycloakService } from 'keycloak-angular';
import { environment } from '../../../environments/environment';

export const authGuard: CanActivateFn = async () => {
  if (environment.authDisabled) return true;
  const kc = inject(KeycloakService);
  if (await kc.isLoggedIn()) return true;
  await kc.login({ redirectUri: window.location.href });
  return false;
};
```

Supprimer `guest.guard.ts` (plus utile — pas de pages /auth).

### 6.7 Pages à supprimer

- `frontend/src/app/features/auth/login/login.component.ts` (+ html/css)
- `frontend/src/app/features/auth/register/register.component.ts` (+ html/css)
- Toute autre page sous `features/auth/`

Mettre à jour `frontend/src/app/app.routes.ts` :
- Retirer les routes `/auth/login`, `/auth/register`.
- Garder les routes protégées (`/chat`, `/profile`) avec `canActivate: [authGuard]`.

### 6.8 Mode AUTH_DISABLED frontend

Comportement quand `environment.authDisabled === true` :
- `KeycloakService.init()` n'est pas appelé.
- `keycloakBearerInterceptor` ne touche pas les requêtes.
- `authGuard` retourne `true` directement.
- `AuthService.loadCurrentUser()` appelle directement `GET /users/me` (le backend retourne le user de bypass).

Le front doit être lancé avec `authDisabled: true` dans `environment.ts` ET le backend avec `AUTH_DISABLED=true`. Si l'un des deux est mal configuré → 401 ou redirect Keycloak en boucle.

---

## 7. Seed et migration des données

`backend/app/scripts/seed.py` :
- Retirer `hashed_password = hash_password(...)`.
- Soit générer des UUIDs aléatoires (à pré-créer dans Keycloak) soit utiliser des UUIDs fixes documentés et créés dans Keycloak via un realm import JSON.

**Recommandation** : créer un fichier `keycloak/realm-export.json` qui contient :
- Le realm `without-border` configuré.
- Le client `wb-frontend`.
- 3-4 utilisateurs de test (Sophie, Marc, Yuki, Aisha) avec UUIDs fixes correspondant à ceux du seed local.

Procédure d'import :
```bash
# Sur Keycloak (admin)
kcadm.sh create realms -f realm-export.json
# OU via UI : Realm settings > Import
```

Le seed Python (`seed.py`) devient :
```python
DEMO_USERS = [
    {"id": "00000000-0000-0000-0000-000000000001", "email": "sophie@wb.test", "username": "sophie", "preferred_language": "fr"},
    {"id": "00000000-0000-0000-0000-000000000002", "email": "marc@wb.test", "username": "marc", "preferred_language": "en"},
    # ...
]
```

Les mêmes UUIDs sont utilisés comme `id` dans Keycloak (champ `id` de l'objet user dans le JSON d'import).

---

## 8. Docker compose

`docker-compose.yml` — modifications :

- **Pas d'ajout de service Keycloak** (instance existante hors compose).
- Ajouter dans le service `backend` :
  ```yaml
  environment:
    - KEYCLOAK_URL=${KEYCLOAK_URL}
    - KEYCLOAK_REALM=${KEYCLOAK_REALM:-without-border}
    - KEYCLOAK_AUDIENCE=${KEYCLOAK_AUDIENCE:-wb-frontend}
    - AUTH_DISABLED=${AUTH_DISABLED:-false}
    - AUTH_DISABLED_USER_ID=${AUTH_DISABLED_USER_ID:-}
  ```

Si Keycloak est sur un autre host/réseau et qu'on est en local, vérifier que le backend peut résoudre l'URL Keycloak (DNS, ports ouverts).

---

## 9. Tests

### 9.1 Tests unitaires backend

`backend/tests/test_keycloak_validation.py` :
- Mock `httpx` pour servir un JWKS test.
- Génère un token RS256 signé par une clé de test.
- Vérifie : token valide, token expiré, token avec mauvais issuer, token avec mauvais audience, token sans `kid`, kid inconnu.

`backend/tests/test_keycloak_sync.py` :
- Mock un set de claims.
- Vérifie : création au premier appel, update si email/username changent, idempotence si rien ne change.

`backend/tests/test_auth_disabled.py` :
- Mode `AUTH_DISABLED=true` : `GET /users/me` sans header → 200 + premier user actif.
- Mode `AUTH_DISABLED=true` + `AUTH_DISABLED_USER_ID` set → user spécifique retourné.
- Mode `AUTH_DISABLED=true` + DB vide → 503.

### 9.2 Tests frontend

- Test du guard `authGuard` avec `authDisabled: true` → passe direct.
- Test du `keycloakBearerInterceptor` avec `authDisabled: true` → ne touche pas la requête.

### 9.3 Tests d'intégration

Optionnel mais recommandé : un test e2e Playwright qui :
1. Lance la stack (Keycloak en testcontainer ou utilise l'instance dev).
2. Effectue le flow login complet.
3. Appelle `GET /users/me` et vérifie le retour.

---

## 10. Critères d'acceptation

### 10.1 Configuration Keycloak
- [ ] Realm `without-border` créé et accessible.
- [ ] Client public `wb-frontend` créé avec PKCE S256, redirect URIs corrects.
- [ ] (Optionnel) Client confidentiel `wb-backend` créé.
- [ ] Au moins 1 utilisateur de test créé dans Keycloak.

### 10.2 Backend
- [ ] `python-keycloak` (si retenu) ajouté dans `requirements.txt`.
- [ ] `passlib` retiré (ou justifié si gardé pour autre usage).
- [ ] Variables `KEYCLOAK_*` documentées dans `.env.example`.
- [ ] `app/core/security/keycloak.py` créé, validation JWKS fonctionnelle.
- [ ] `app/services/keycloak_sync_service.py` créé, lazy-sync fonctionnel.
- [ ] `get_current_user` valide les tokens Keycloak.
- [ ] `POST /api/v1/auth/{register,login,refresh}` retournent 404.
- [ ] `GET /api/v1/users/me` retourne 200 avec un token Keycloak valide.
- [ ] `GET /api/v1/users/me` retourne 401 sans token / token invalide.
- [ ] `PUT /api/v1/users/me` ne permet plus de modifier email/username.
- [ ] WebSocket `/ws/channels/{id}` valide le token Keycloak en query string.
- [ ] Migration Alembic `drop_hashed_password_*.py` créée et appliquable.
- [ ] Modèle ORM `User` ne contient plus `hashed_password`.
- [ ] Tests unitaires Keycloak passent.

### 10.3 Frontend
- [ ] `keycloak-angular` et `keycloak-js` installés.
- [ ] `environment.ts` contient la config Keycloak + `authDisabled`.
- [ ] `app.config.ts` initialise Keycloak via `APP_INITIALIZER`.
- [ ] `silent-check-sso.html` présent dans `assets/`.
- [ ] `auth.service.ts` réécrit comme wrapper de `KeycloakService`.
- [ ] `keycloakBearerInterceptor` créé et enregistré.
- [ ] `authGuard` réécrit, `guestGuard` supprimé.
- [ ] Pages `login.component.ts` et `register.component.ts` supprimées.
- [ ] Routes `/auth/*` retirées de `app.routes.ts`.
- [ ] Click "Login" → redirect Keycloak → callback → app fonctionnelle.
- [ ] Click "Logout" → invalidation session Keycloak + retour à l'app.

### 10.4 Mode AUTH_DISABLED
- [ ] Backend : `AUTH_DISABLED=true` → toutes les routes répondent 200 sans header `Authorization`.
- [ ] Frontend : `authDisabled: true` → l'app démarre sans appeler Keycloak, aucun redirect.
- [ ] Combiné : la stack est entièrement utilisable sans Keycloak (utile pour démos hors ligne).

### 10.5 Migration et seed
- [ ] Le seed crée des users avec UUIDs fixes alignés avec Keycloak.
- [ ] Document `keycloak/realm-export.json` fourni avec utilisateurs de test.
- [ ] La doc README contient les étapes : import realm + seed local.

---

## 11. Vérification end-to-end

### 11.1 Mode Keycloak activé
1. Vérifier l'instance Keycloak : `curl https://keycloak.exemple.com/realms/without-border/.well-known/openid-configuration` doit répondre.
2. Importer `realm-export.json` dans Keycloak (UI ou `kcadm.sh`).
3. Configurer `.env` backend avec `KEYCLOAK_URL`, `KEYCLOAK_REALM`, `KEYCLOAK_AUDIENCE`, `AUTH_DISABLED=false`.
4. Configurer `environment.ts` frontend avec la même config + `authDisabled: false`.
5. `cd backend && alembic upgrade head`
6. `cd backend && python -m app.scripts.seed`
7. `docker compose up -d --build`
8. Ouvrir `http://localhost:4200` → redirect Keycloak.
9. Login avec sophie / mot-de-passe-test → callback → app affiche le profil.
10. Vérifier `GET /api/v1/users/me` via DevTools Network → 200 OK + token Bearer.
11. Envoyer un message dans un channel → broadcast WebSocket fonctionne.
12. Logout → retour login screen.

### 11.2 Mode AUTH_DISABLED
1. `AUTH_DISABLED=true` dans `backend/.env`.
2. `authDisabled: true` dans `frontend/src/environments/environment.ts`.
3. Restart les deux services.
4. Ouvrir `http://localhost:4200` → app accessible sans login.
5. Toutes les requêtes API passent sans header `Authorization`.
6. Le user retourné par `GET /users/me` est le premier user actif (ou `AUTH_DISABLED_USER_ID`).

### 11.3 Tests automatisés
```bash
cd backend && pytest tests/ -v
cd frontend && npm test
```

---

## 12. Ordre d'exécution recommandé

1. **Préparation Keycloak** (hors code)
   - Créer le realm via UI ou import JSON.
   - Créer le client `wb-frontend`.
   - Créer 2-3 users de test.

2. **Backend — validation token**
   - Ajouter les variables `KEYCLOAK_*` dans `settings.py` et `.env.example`.
   - Créer `app/core/security/keycloak.py`.
   - Tests unitaires de validation JWKS.

3. **Backend — lazy-sync + auth dependency**
   - Créer `app/services/keycloak_sync_service.py`.
   - Réécrire `get_current_user` dans `jwt_handler.py`.
   - Garder l'ancien chemin de fallback `AUTH_DISABLED` intact.

4. **Backend — modèle User**
   - Modifier `models.py` (drop `hashed_password`).
   - Initier Alembic (revision initiale + migration drop).
   - Adapter le seed.

5. **Backend — endpoints**
   - Supprimer `auth_router.py`, retirer son wiring.
   - Adapter `users_router.py` (PUT /me sans email/username).
   - Adapter le WebSocket auth.

6. **Backend — tests**
   - Faire passer toute la suite, smoke test manuel.

7. **Frontend — install & init**
   - `npm i keycloak-angular keycloak-js`.
   - `environment.ts` + `app.config.ts` + `silent-check-sso.html`.

8. **Frontend — services & guards**
   - Réécrire `auth.service.ts`.
   - Créer `keycloakBearerInterceptor`, supprimer `jwt.interceptor`.
   - Réécrire `authGuard`, supprimer `guestGuard`.

9. **Frontend — pages**
   - Supprimer `features/auth/login` et `features/auth/register`.
   - Nettoyer `app.routes.ts`.

10. **Validation end-to-end**
    - Smoke test mode Keycloak.
    - Smoke test mode `AUTH_DISABLED`.
    - Tests automatisés.

11. **Docs & PR**
    - Mettre à jour le README (sections "Setup Keycloak" et "Mode dev sans auth").
    - Ouvrir la PR.
