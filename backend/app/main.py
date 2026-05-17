"""FastAPI application factory."""
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import os

from app.api.v1.endpoints.users_router import router as users_router
from app.api.v1.endpoints.channels_router import router as channels_router
from app.api.v1.endpoints.messages_router import router as messages_router
from app.api.v1.endpoints.ai_router import router as ai_router
from app.api.v1.endpoints.files_router import router as files_router
from app.api.v1.endpoints.agents_router import router as agents_router
from app.core.config.settings import settings
from app.core.database import create_tables


@asynccontextmanager
async def lifespan(app: FastAPI):
    await create_tables()
    if settings.AUTO_SEED:
        try:
            from app.seed import seed
            await seed()
        except Exception as e:
            print(f"[seed] Skipped: {e}")
    if settings.AUTH_DISABLED:
        print("\n⚠️  AUTH_DISABLED=true — authentication is OFF. Do not use in production.\n")
    yield


def create_app() -> FastAPI:
    app = FastAPI(
        title="WithoutBorder API",
        description="Multilingual real-time collaboration platform.",
        version="1.0.0",
        lifespan=lifespan,
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.ALLOWED_ORIGINS,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    prefix = "/api/v1"
    app.include_router(users_router, prefix=prefix)
    app.include_router(channels_router, prefix=prefix)
    app.include_router(messages_router, prefix=prefix)
    app.include_router(ai_router, prefix=prefix)
    app.include_router(files_router, prefix=prefix)
    app.include_router(agents_router, prefix=prefix)

    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
    app.mount("/uploads", StaticFiles(directory=settings.UPLOAD_DIR), name="uploads")

    @app.get("/health", tags=["system"])
    async def health():
        return {
            "status": "ok",
            "version": "1.0.0",
            "auth_disabled": settings.AUTH_DISABLED,
        }

    return app


app = create_app()
