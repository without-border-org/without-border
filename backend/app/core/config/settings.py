"""Application settings — loaded from environment variables."""
from pydantic_settings import BaseSettings
import json


class Settings(BaseSettings):
    APP_NAME: str = "WithoutBorder"
    DEBUG: bool = False
    ALLOWED_ORIGINS: list[str] = ["http://localhost:4200"]

    DATABASE_URL: str = "postgresql+asyncpg://wb_user:wb_password@localhost:5432/withoutborder"

    SECRET_KEY: str = "change-me-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    LLM_PROVIDER: str = "ollama"
    LLM_MODEL: str = "gemma4:9b"
    OLLAMA_BASE_URL: str = "http://localhost:11434"
    VERTEXAI_PROJECT: str = ""
    VERTEXAI_LOCATION: str = "us-central1"

    MAX_CONTEXT_MESSAGES: int = 20
    UPLOAD_DIR: str = "./uploads"
    MAX_UPLOAD_SIZE_MB: int = 20

    class Config:
        env_file = ".env"
        case_sensitive = True

    def model_post_init(self, __context):
        import os
        os.makedirs(self.UPLOAD_DIR, exist_ok=True)


settings = Settings()
