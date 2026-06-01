"""Lazy-sync: create or update local user mirror on first Keycloak auth.

When a user authenticates via Keycloak, their minimal profile (id, email, username)
is synchronized to the local database. Subsequent updates are triggered only if
critical fields change (email, username, enabled status).
"""
import uuid
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models.models import User
from app.repositories.repositories import UserRepository
from app.schemas.schemas import UserRead


class KeycloakUserSyncService:
    """Service pour synchroniser les utilisateurs Keycloak vers la DB locale.
    
    La synchronisation est "lazy" : elle se déclenche au premier appel d'un utilisateur
    authentifié et ne met à jour que les champs synchronisés depuis Keycloak.
    """
    
    def __init__(self, db: AsyncSession):
        self.db = db
        self.repo = UserRepository(db)

    async def upsert_from_token(self, claims: dict) -> UserRead:
        """Create or update user from Keycloak token claims.
        
        Creates a new local user if doesn't exist, otherwise performs a soft update
        of synchronized fields (email, username, enabled status).
        
        Args:
            claims: JWT claims dict from validate_keycloak_token
                Expected keys: sub, email, preferred_username, locale, enabled
                
        Returns:
            UserRead: The user object (created or updated)
            
        Raises:
            ValueError: If 'sub' claim is missing or not a valid UUID
        """
        sub = claims.get("sub")
        if not sub:
            raise ValueError("Keycloak token missing 'sub' claim")

        try:
            user_id = uuid.UUID(sub)
        except ValueError:
            raise ValueError(f"Invalid UUID in 'sub' claim: {sub}")

        email = claims.get("email", "")
        # Use full name from token if available, fall back to preferred_username
        full_name = claims.get("name") or ""
        if full_name:
            given = claims.get("given_name", "")
            family = claims.get("family_name", "")
            username = f"{given} {family}".strip() if (given or family) else full_name
        else:
            username = claims.get("preferred_username", email)
        locale = claims.get("locale", "fr")
        is_enabled = bool(claims.get("enabled", True))

        # Check if user exists
        existing = await self.repo.get_by_id(user_id)
        if existing:
            # Soft update: sync email, active status, and locale from Keycloak.
            # Username is preserved from the seed / user profile — Keycloak preferred_username
            # is a login handle and should not overwrite the display name.
            changed = False
            if existing.email != email:
                existing.email = email
                changed = True
            if existing.is_active != is_enabled:
                existing.is_active = is_enabled
                changed = True
            if locale and existing.preferred_language != locale:
                existing.preferred_language = locale
                changed = True

            if changed:
                await self.db.commit()
                await self.db.refresh(existing)

            return UserRead.model_validate(existing)

        # Create new user
        new_user = User(
            id=user_id,
            email=email,
            username=username,
            preferred_language=locale,
            status="active",
            agentic_enabled=False,
            is_active=is_enabled,
        )
        self.db.add(new_user)
        await self.db.commit()
        await self.db.refresh(new_user)
        
        return UserRead.model_validate(new_user)
