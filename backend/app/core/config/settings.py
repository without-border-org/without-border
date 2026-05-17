"""Application settings — loaded from environment variables."""
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    APP_NAME: str = "WithoutBorder"
    DEBUG: bool = False
    ALLOWED_ORIGINS: list[str] = ["http://localhost:4200", "http://localhost:3000", "http://127.0.0.1:4200"]

    DATABASE_URL: str = "postgresql+asyncpg://wb_user:wb_password@localhost:5432/withoutborder"

    # ── Keycloak / OIDC ──────────────────────────────────────────────────────
    KEYCLOAK_URL: str = ""
    KEYCLOAK_REALM: str = "without-border"
    KEYCLOAK_AUDIENCE: str = "without-border-frontend"
    KEYCLOAK_VERIFY_AUD: bool = True
    KEYCLOAK_JWKS_CACHE_TTL: int = 3600

    # ── Legacy JWT (kept for backward compatibility, not used with Keycloak) ─
    SECRET_KEY: str = "change-me-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # ── Auth bypass (LOCAL DEV ONLY) ─────────────────────────────────────────
    # Set AUTH_DISABLED=true in .env to skip all authentication.
    # NEVER enable in production.
    AUTH_DISABLED: bool = False
    AUTH_DISABLED_USER_ID: str = ""  # fixed user id to impersonate when auth is off

    # ── LLM ──────────────────────────────────────────────────────────────────
    LLM_PROVIDER: str = "ollama"
    LLM_MODEL: str = "gemma4:9b"
    OLLAMA_BASE_URL: str = "http://localhost:11434"
    VERTEXAI_PROJECT: str = ""
    VERTEXAI_LOCATION: str = "us-central1"

    MAX_CONTEXT_MESSAGES: int = 20
    UPLOAD_DIR: str = "./uploads"
    MAX_UPLOAD_SIZE_MB: int = 20
    AUTO_SEED: bool = True

    class Config:
        env_file = ".env"
        case_sensitive = True

    @property
    def keycloak_issuer(self) -> str:
        """Construct Keycloak issuer URL from base URL and realm."""
        return f"{self.KEYCLOAK_URL.rstrip('/')}/realms/{self.KEYCLOAK_REALM}"

    @property
    def keycloak_jwks_url(self) -> str:
        """Construct JWKS endpoint URL."""
        return f"{self.keycloak_issuer}/protocol/openid-connect/certs"

    def model_post_init(self, __context):
        import os
        os.makedirs(self.UPLOAD_DIR, exist_ok=True)


settings = Settings()
