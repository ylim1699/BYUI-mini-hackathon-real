from fastapi import APIRouter, Depends

from .. import db
from ..auth import User, current_user

router = APIRouter()


@router.get("/me")
async def me(user: User = Depends(current_user)) -> dict[str, object]:
    conn = await db.get_connection(user.id)
    return {
        "id": user.id,
        "email": user.email,
        "canvas": "token" if conn.get("canvas_token_enc") else ("feed" if conn.get("canvas_ics_enc") else None),
        "google": bool(conn.get("google_refresh_enc")),
    }
