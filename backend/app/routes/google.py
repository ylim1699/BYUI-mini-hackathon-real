from fastapi import APIRouter, Depends

from .. import db, google_cal
from ..auth import User, current_user
from ..crypto import encrypt
from ..schemas import GoogleLink, SyncIn, SyncResult

router = APIRouter(prefix="/google")


@router.post("/link")
async def link(body: GoogleLink, user: User = Depends(current_user)) -> dict[str, bool]:
    """Called right after Google sign-in with the refresh token Supabase hands the browser once."""
    await google_cal.access_token(body.refresh_token)  # proves it works before saving
    await db.save_connection(user.id, google_refresh_enc=encrypt(body.refresh_token))
    return {"ok": True}


@router.post("/unlink")
async def unlink(user: User = Depends(current_user)) -> dict[str, bool]:
    await db.save_connection(user.id, google_refresh_enc=None)
    return {"ok": True}


@router.post("/sync", response_model=SyncResult)
async def sync(body: SyncIn, user: User = Depends(current_user)) -> SyncResult:
    return await google_cal.sync(user.id, body)


@router.post("/remove-all")
async def remove_all(user: User = Depends(current_user)) -> dict[str, bool]:
    """Removes everything Syllabus Planner put in Google Calendar."""
    return {"removed": await google_cal.remove_all(user.id)}
