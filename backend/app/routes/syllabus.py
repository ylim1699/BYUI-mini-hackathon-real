from fastapi import APIRouter, Depends

from .. import gemini
from ..auth import User, current_user
from ..schemas import ParsedSyllabus, SyllabusParseIn

router = APIRouter(prefix="/syllabus")


@router.post("/parse", response_model=ParsedSyllabus)
async def parse(body: SyllabusParseIn, user: User = Depends(current_user)) -> ParsedSyllabus:
    await gemini.check_quota(user.id)
    return await gemini.parse_syllabus(body.text, body.course_code, body.semester_start)
