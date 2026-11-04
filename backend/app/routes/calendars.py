"""Connect, sync, and remove for each calendar provider (Google, Outlook). Same routes for both."""
from types import ModuleType

from fastapi import APIRouter, Depends
from fastapi.responses import RedirectResponse

from .. import db, google_cal, outlook
from ..auth import User, current_user
from ..config import get_settings
from ..crypto import decrypt, encrypt
from ..errors import AppError
from ..oauth import make_state, read_state
from ..schemas import SyncIn, SyncResult


def make_router(p: ModuleType) -> APIRouter:
    r = APIRouter(prefix=f"/{p.NAME}")

    @r.post("/start")
    async def start(user: User = Depends(current_user)) -> dict[str, str]:
        """Returns the provider's consent page. The browser goes there, then comes back to /callback."""
        if not p.configured():
            raise AppError(503, f"{p.LABEL} isn't set up on the server yet.", "config")
        return {"url": p.auth_url(make_state(user.id, p.NAME))}

    @r.get("/callback", include_in_schema=False)
    async def callback(code: str | None = None, state: str | None = None, error: str | None = None) -> RedirectResponse:
        back = f"{get_settings().base_url}/sync?calendar={p.NAME}&result="
        if error or not code or not state:
            return RedirectResponse(back + "cancelled", status_code=302)
        try:
            user_id = read_state(state, p.NAME)
            refresh = await p.exchange(code)
            await db.save_connection(user_id, **{p.REFRESH_FIELD: encrypt(refresh)})
        except AppError:
            return RedirectResponse(back + "error", status_code=302)
        return RedirectResponse(back + "connected", status_code=302)

    @r.post("/disconnect")
    async def disconnect(user: User = Depends(current_user)) -> dict[str, bool]:
        conn = await db.get_connection(user.id)
        token = decrypt(conn.get(p.REFRESH_FIELD))
        if token:
            try:
                await p.revoke(token)
            except Exception:  # best effort
                pass
        await db.save_connection(user.id, **{p.REFRESH_FIELD: None})
        return {"ok": True}

    @r.post("/sync", response_model=SyncResult)
    async def sync(body: SyncIn, user: User = Depends(current_user)) -> SyncResult:
        return await p.sync(user.id, body)

    @r.post("/remove-all")
    async def remove_all(user: User = Depends(current_user)) -> dict[str, bool]:
        return {"removed": await p.remove_all(user.id)}

    return r


google_router = make_router(google_cal)
outlook_router = make_router(outlook)
