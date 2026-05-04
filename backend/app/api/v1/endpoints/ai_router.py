"""AI endpoints — summary, action plan, full report, health check."""
import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.core.security.jwt_handler import get_current_user
from app.repositories.repositories import ChannelRepository, MessageRepository, UserRepository
from app.agents.agent_service import AgentService
from app.schemas.schemas import SummaryResponse, ActionPlanResponse, AIHealthResponse, UserRead
from app.helpers.llm_provider import get_llm_provider

router = APIRouter(prefix="/ai", tags=["ai"])
agent_svc = AgentService()


@router.get("/health", response_model=AIHealthResponse)
async def ai_health(current_user: UserRead = Depends(get_current_user)):
    """Check Gemma 4 availability."""
    from app.core.config.settings import settings
    llm = get_llm_provider()
    available = await llm.is_available()
    return AIHealthResponse(
        provider=settings.LLM_PROVIDER,
        model=settings.LLM_MODEL,
        available=available,
        message="Gemma 4 is ready" if available else "Model unavailable — check Ollama or Vertex config",
    )


@router.post("/channels/{channel_id}/summary", response_model=SummaryResponse)
async def generate_summary(
    channel_id: uuid.UUID,
    limit: int = 50,
    current_user: UserRead = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    ch_repo = ChannelRepository(db)
    if not await ch_repo.is_member(channel_id, current_user.id):
        raise HTTPException(403, "Not a member")
    msg_repo = MessageRepository(db)
    messages = await msg_repo.get_recent(channel_id, limit=limit)
    if not messages:
        raise HTTPException(404, "No messages to summarize")
    context = [{"sender_username": m.sender_id, "original_content": m.original_content, "is_agentic": m.is_agentic} for m in messages]
    summary = await agent_svc.generate_summary(context, current_user.preferred_language)
    return SummaryResponse(channel_id=channel_id, summary=summary, generated_at=datetime.now(timezone.utc))


@router.post("/channels/{channel_id}/action-plan", response_model=ActionPlanResponse)
async def generate_action_plan(
    channel_id: uuid.UUID,
    limit: int = 50,
    current_user: UserRead = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    ch_repo = ChannelRepository(db)
    if not await ch_repo.is_member(channel_id, current_user.id):
        raise HTTPException(403, "Not a member")
    msg_repo = MessageRepository(db)
    messages = await msg_repo.get_recent(channel_id, limit=limit)
    if not messages:
        raise HTTPException(404, "No messages")
    context = [{"sender_username": m.sender_id, "original_content": m.original_content, "is_agentic": m.is_agentic} for m in messages]
    plan = await agent_svc.generate_action_plan(context, current_user.preferred_language)
    return ActionPlanResponse(channel_id=channel_id, action_plan=plan, generated_at=datetime.now(timezone.utc))


@router.post("/channels/{channel_id}/report")
async def generate_report(
    channel_id: uuid.UUID,
    limit: int = 100,
    current_user: UserRead = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    ch_repo = ChannelRepository(db)
    if not await ch_repo.is_member(channel_id, current_user.id):
        raise HTTPException(403, "Not a member")
    msg_repo = MessageRepository(db)
    user_repo = UserRepository(db)
    messages = await msg_repo.get_recent(channel_id, limit=limit)
    if not messages:
        raise HTTPException(404, "No messages")

    members = await ch_repo.get_members(channel_id)
    participant_names = [m.username for m in members]
    context = [{"sender_username": m.sender_id, "original_content": m.original_content, "is_agentic": m.is_agentic} for m in messages]

    report = await agent_svc.generate_report(
        messages=context,
        target_language=current_user.preferred_language,
        date=datetime.now(timezone.utc).strftime("%B %d, %Y"),
        participants=participant_names,
    )
    return {"channel_id": str(channel_id), "report": report, "generated_at": datetime.now(timezone.utc).isoformat()}
