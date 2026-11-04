import time
from dataclasses import dataclass

import httpx
from fastapi import Header

from .config import get_settings
from .errors import AppError


@dataclass(frozen=True)
class User:
    id: str
    email: str | None


# Short cache so one page load doesn't verify the same token many times.
_cache: dict[str, tuple[float, User]] = {}
_TTL = 60.0


async def current_user(authorization: str | None = Header(default=None)) -> User:
    """FastAPI dependency: verifies the Supabase access token with Supabase Auth."""
    if not authorization or not authorization.lower().startswith("bearer "):
        raise AppError(401, "Please sign in again.", "unauthenticated")
    token = authorization.split(" ", 1)[1].strip()

    hit = _cache.get(token)
    now = time.monotonic()
    if hit and now - hit[0] < _TTL:
        return hit[1]

    s = get_settings()
    async with httpx.AsyncClient(timeout=10) as client:
        r = await client.get(
            f"{s.supabase_url}/auth/v1/user",
            headers={"apikey": s.supabase_anon_key, "Authorization": f"Bearer {token}"},
        )
    if r.status_code != 200:
        raise AppError(401, "Please sign in again.", "unauthenticated")
    data = r.json()
    user = User(id=data["id"], email=data.get("email"))

    if len(_cache) > 1000:
        _cache.clear()
    _cache[token] = (now, user)
    return user
