"""Agent endpoints — read-only list."""
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.core.security.jwt_handler import get_current_user
from app.schemas.schemas import AgentRead, UserRead
from app.repositories.repositories import AgentRepository

router = APIRouter(prefix="/agents", tags=["agents"])


@router.get("", response_model=list[AgentRead])
async def list_agents(
    current_user: UserRead = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    repo = AgentRepository(db)
    agents = await repo.list_all()
    return [AgentRead.model_validate(a) for a in agents]
