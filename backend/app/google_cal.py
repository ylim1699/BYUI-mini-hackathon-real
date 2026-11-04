"""Google Calendar: connect with OAuth, sync into a separate 'Syllabus Planner' calendar.

Scope: https://www.googleapis.com/auth/calendar.app.created
(lets the app create its own calendar and manage events in it, nothing else).
"""
import asyncio
import logging
from datetime import datetime, timezone
from typing import Any
from urllib.parse import urlencode

import httpx

from . import db
from .config import get_settings
from .crypto import decrypt
from .errors import AppError
from .events import Ev, build
from .schemas import SyncIn, SyncResult

NAME = "google"
LABEL = "Google Calendar"
REFRESH_FIELD = "google_refresh_enc"
CAL_FIELD = "google_calendar_id"
SCOPE = "https://www.googleapis.com/auth/calendar.app.created"
API = "https://www.googleapis.com/calendar/v3"
TOKEN_URL = "https://oauth2.googleapis.com/token"
CAL_NAME = "Syllabus Planner"
TAG = "syllabusPlanner"
log = logging.getLogger("uvicorn.error")


async def call(client: httpx.AsyncClient, method: str, url: str, **kw: Any) -> httpx.Response:
    """One Google Calendar request, retried with backoff when Google says to slow down."""
    r = await client.request(method, url, **kw)
    for wait in (1, 2, 4, 8):
        limited = r.status_code == 429 or (r.status_code == 403 and "ateLimit" in r.text) or "usageLimits" in r.text
        if not (limited or r.status_code >= 500):
            break
        await asyncio.sleep(wait)
        r = await client.request(method, url, **kw)
    if r.status_code >= 400 and r.status_code not in (404, 410):
        log.error("Google %s %s -> %s: %s", method, url.rsplit("/calendars/", 1)[-1][:60], r.status_code, r.text[:400])
    return r


def configured() -> bool:
    s = get_settings()
    return bool(s.google_client_id and s.google_client_secret)


def redirect_uri() -> str:
    return f"{get_settings().base_url}/api/google/callback"


def auth_url(state: str) -> str:
    q = {
        "client_id": get_settings().google_client_id,
        "redirect_uri": redirect_uri(),
        "response_type": "code",
        "scope": SCOPE,
        "access_type": "offline",  # gives a refresh token
        "prompt": "consent",       # ...every time, even on reconnect
        "state": state,
    }
    return "https://accounts.google.com/o/oauth2/v2/auth?" + urlencode(q)


async def exchange(code: str) -> str:
    s = get_settings()
    async with httpx.AsyncClient(timeout=15) as c:
        r = await c.post(TOKEN_URL, data={
            "code": code, "client_id": s.google_client_id, "client_secret": s.google_client_secret,
            "redirect_uri": redirect_uri(), "grant_type": "authorization_code",
        })
    tok = r.json().get("refresh_token") if r.status_code == 200 else None
    if not tok:
        raise AppError(400, "Google didn't finish connecting. Try again.", "google")
    return str(tok)


async def revoke(refresh_token: str) -> None:
    async with httpx.AsyncClient(timeout=10) as c:
        await c.post("https://oauth2.googleapis.com/revoke", data={"token": refresh_token})


async def access_token(refresh_token: str) -> str:
    s = get_settings()
    async with httpx.AsyncClient(timeout=15) as c:
        r = await c.post(TOKEN_URL, data={
            "client_id": s.google_client_id, "client_secret": s.google_client_secret,
            "refresh_token": refresh_token, "grant_type": "refresh_token",
        })
    if r.status_code != 200:
        raise AppError(401, "Google Calendar access ended. Connect it again.", "google_reconnect")
    return str(r.json()["access_token"])


def to_google(ev: Ev, tz: str) -> dict[str, Any]:
    body: dict[str, Any] = {
        "summary": ev.title,
        "description": ev.description,
        "start": {"dateTime": ev.start.isoformat(), "timeZone": tz},
        "end": {"dateTime": ev.end.isoformat(), "timeZone": tz},
        "reminders": {"useDefault": False, "overrides": [{"method": "popup", "minutes": m} for m in ev.reminders]},
        "extendedProperties": {"private": {TAG: "1", "spKey": ev.key}},
    }
    if not ev.busy:
        body["transparency"] = "transparent"
    if ev.until:
        body["recurrence"] = [f"RRULE:FREQ=WEEKLY;UNTIL={ev.until}T235959Z"]
    return body


def build_events(body: SyncIn) -> list[tuple[str, dict[str, Any]]]:
    return [(e.key, to_google(e, body.time_zone)) for e in build(body)]


async def _ensure_calendar(client: httpx.AsyncClient, user_id: str, cal_id: str | None, tz: str) -> str:
    if cal_id:
        r = await client.get(f"{API}/calendars/{cal_id}")
        if r.status_code == 200:
            return cal_id
    r = await client.post(f"{API}/calendars", json={"summary": CAL_NAME, "timeZone": tz})
    if r.status_code >= 400:
        raise AppError(502, "Couldn't create the Syllabus Planner calendar in Google.", "google")
    new_id = str(r.json()["id"])
    await db.save_connection(user_id, **{CAL_FIELD: new_id})
    return new_id


async def _existing(client: httpx.AsyncClient, cal_id: str) -> dict[str, str]:
    """Our key -> Google event id, for events that still have upcoming occurrences (past ones are left alone)."""
    found: dict[str, str] = {}
    page: str | None = None
    for _ in range(20):
        params = {"privateExtendedProperty": f"{TAG}=1", "maxResults": "2500", "showDeleted": "false",
                  "timeMin": datetime.now(timezone.utc).isoformat()}
        if page:
            params["pageToken"] = page
        r = await client.get(f"{API}/calendars/{cal_id}/events", params=params)
        if r.status_code >= 400:
            break
        data = r.json()
        for ev in data.get("items", []):
            key = ev.get("extendedProperties", {}).get("private", {}).get("spKey")
            if key:
                found[key] = ev["id"]
        page = data.get("nextPageToken")
        if not page:
            break
    return found


async def sync(user_id: str, body: SyncIn) -> SyncResult:
    conn = await db.get_connection(user_id)
    refresh = decrypt(conn.get(REFRESH_FIELD))
    if not refresh:
        raise AppError(400, "Connect Google Calendar first.", "google_reconnect")
    token = await access_token(refresh)
    events = build_events(body)
    sem = asyncio.Semaphore(3)

    async with httpx.AsyncClient(timeout=20, headers={"Authorization": f"Bearer {token}"}) as client:
        cal_id = await _ensure_calendar(client, user_id, conn.get(CAL_FIELD), body.time_zone)
        existing = await _existing(client, cal_id)
        wanted = {k for k, _ in events}

        async def put(key: str, ev: dict[str, Any]) -> str:
            async with sem:
                if key in existing:
                    r = await call(client, "PUT", f"{API}/calendars/{cal_id}/events/{existing[key]}", json=ev)
                    return "updated" if r.status_code < 400 else "failed"
                r = await call(client, "POST", f"{API}/calendars/{cal_id}/events", json=ev)
                return "created" if r.status_code < 400 else "failed"

        async def drop(event_id: str) -> str:
            async with sem:
                r = await call(client, "DELETE", f"{API}/calendars/{cal_id}/events/{event_id}")
                return "removed" if r.status_code < 400 or r.status_code in (404, 410) else "failed"

        results = await asyncio.gather(
            *[put(k, ev) for k, ev in events],
            *[drop(eid) for k, eid in existing.items() if k not in wanted],
        )
    return tally(list(results))


def tally(results: list[str]) -> SyncResult:
    return SyncResult(
        created=results.count("created"), updated=results.count("updated"),
        removed=results.count("removed"), failed=results.count("failed"), calendar_name=CAL_NAME,
    )


async def remove_all(user_id: str) -> bool:
    """Deletes the whole 'Syllabus Planner' calendar: everything this app added, nothing else."""
    conn = await db.get_connection(user_id)
    refresh = decrypt(conn.get(REFRESH_FIELD))
    cal_id = conn.get(CAL_FIELD)
    if not refresh or not cal_id:
        return False
    token = await access_token(refresh)
    async with httpx.AsyncClient(timeout=20, headers={"Authorization": f"Bearer {token}"}) as c:
        r = await c.delete(f"{API}/calendars/{cal_id}")
    if r.status_code >= 400 and r.status_code not in (404, 410):
        raise AppError(502, "Google didn't remove the calendar. Try again.", "google")
    await db.save_connection(user_id, **{CAL_FIELD: None})
    return True
