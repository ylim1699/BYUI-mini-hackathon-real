from fastapi import APIRouter, Depends

from .. import gemini
from ..auth import User, current_user
from ..schemas import Summary, SummaryIn

router = APIRouter()


@router.post("/summary", response_model=Summary)
async def summary(body: SummaryIn, user: User = Depends(current_user)) -> Summary:
    await gemini.check_quota(user.id)
    return await gemini.summarize(body)
