"""File endpoints — upload, download, translate content."""
import os
import uuid
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession
import aiofiles
from app.core.database import get_db
from app.core.security.jwt_handler import get_current_user
from app.core.config.settings import settings
from app.agents.agent_service import AgentService
from app.schemas.schemas import UserRead

router = APIRouter(prefix="/files", tags=["files"])
agent_svc = AgentService()

ALLOWED_TYPES = {
    "image/jpeg", "image/png", "image/gif", "image/webp",
    "application/pdf", "text/plain", "text/markdown",
}


@router.post("/upload")
async def upload_file(
    file: UploadFile = File(...),
    current_user: UserRead = Depends(get_current_user),
):
    if file.content_type not in ALLOWED_TYPES:
        raise HTTPException(400, f"File type not allowed: {file.content_type}")

    size = 0
    content = await file.read()
    size = len(content)
    if size > settings.MAX_UPLOAD_SIZE_MB * 1024 * 1024:
        raise HTTPException(413, f"File too large. Max: {settings.MAX_UPLOAD_SIZE_MB}MB")

    ext = file.filename.split(".")[-1] if "." in file.filename else "bin"
    file_id = str(uuid.uuid4())
    filename = f"{file_id}.{ext}"
    filepath = os.path.join(settings.UPLOAD_DIR, filename)

    async with aiofiles.open(filepath, "wb") as f:
        await f.write(content)

    return {
        "file_id": file_id,
        "file_url": f"/api/v1/files/{file_id}",
        "file_name": file.filename,
        "file_type": file.content_type,
        "size": size,
    }


@router.get("/{file_id}")
async def download_file(
    file_id: str,
    current_user: UserRead = Depends(get_current_user),
):
    for fname in os.listdir(settings.UPLOAD_DIR):
        if fname.startswith(file_id):
            filepath = os.path.join(settings.UPLOAD_DIR, fname)
            return FileResponse(filepath)
    raise HTTPException(404, "File not found")


@router.post("/{file_id}/translate")
async def translate_file(
    file_id: str,
    target_language: str,
    current_user: UserRead = Depends(get_current_user),
):
    """Translates text/PDF file content using Gemma 4."""
    filepath = None
    for fname in os.listdir(settings.UPLOAD_DIR):
        if fname.startswith(file_id):
            filepath = os.path.join(settings.UPLOAD_DIR, fname)
            break
    if not filepath:
        raise HTTPException(404, "File not found")

    if filepath.endswith(".pdf"):
        from pypdf import PdfReader
        reader = PdfReader(filepath)
        content = "\n".join(page.extract_text() or "" for page in reader.pages)
    elif filepath.endswith(".txt") or filepath.endswith(".md"):
        async with aiofiles.open(filepath, "r", encoding="utf-8") as f:
            content = await f.read()
    else:
        raise HTTPException(400, "Only text and PDF files can be translated")

    if len(content.strip()) < 10:
        raise HTTPException(400, "File appears to have no readable text")

    translated = await agent_svc.translate_file_content(content, target_language)
    return {"original_length": len(content), "translated_content": translated, "target_language": target_language}
