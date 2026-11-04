"""Outlook (Microsoft Graph): connect with OAuth, sync into a separate 'Syllabus Planner' calendar.

Delegated permissions: offline_access, Calendars.ReadWrite.
Works with personal Microsoft accounts and school/work accounts (if the school allows user consent).
"""
import asyncio
from datetime import datetime, timezone
from typing import Any
from urllib.parse import urlencode

import httpx

from . import db
from .config import get_settings
from .crypto import decrypt, encrypt
from .errors import AppError
from .events import Ev, build
from .google_cal import CAL_NAME, tally
from .schemas import SyncIn, SyncResult

NAME = "outlook"
LABEL = "Outlook"
REFRESH_FIELD = "ms_refresh_enc"
CAL_FIELD = "ms_calendar_id"
SCOPE = "offline_access Calendars.ReadWrite"
AUTH = "https://login.microsoftonline.com/common/oauth2/v2.0"
API = "https://graph.microsoft.com/v1.0"
# Our hidden tag on each event (a fixed GUID for this app + the property name)
PROP = "String {7d3c1d5e-2f0a-4b8e-9a61-5c3f2b9e8a17} Name spKey"


def configured() -> bool:
    s = get_settings()
    return bool(s.microsoft_client_id and s.microsoft_client_secret)


def redirect_uri() -> str:
    return f"{get_settings().base_url}/api/outlook/callback"


def auth_url(state: str) -> str:
    q = {
        "client_id": get_settings().microsoft_client_id,
        "response_type": "code",
        "redirect_uri": redirect_uri(),
        "response_mode": "query",
        "scope": SCOPE,
        "state": state,
        "prompt": "select_account",
    }
    return f"{AUTH}/authorize?" + urlencode(q)


async def _token(data: dict[str, str]) -> dict[str, Any]:
    s = get_settings()
    async with httpx.AsyncClient(timeout=15) as c:
        r = await c.post(f"{AUTH}/token", data={
            **data, "client_id": s.microsoft_client_id, "client_secret": s.microsoft_client_secret, "scope": SCOPE,
        })
    return r.json() if r.status_code == 200 else {}


async def exchange(code: str) -> str:
    tok = (await _token({"grant_type": "authorization_code", "code": code, "redirect_uri": redirect_uri()})).get("refresh_token")
    if not tok:
        raise AppError(400, "Outlook didn't finish connecting. Try again.", "outlook")
    return str(tok)


async def revoke(refresh_token: str) -> None:  # Microsoft has no simple revoke endpoint for this flow
    return None


async def access_token(user_id: str, refresh_token: str) -> str:
    data = await _token({"grant_type": "refresh_token", "refresh_token": refresh_token})
    if not data.get("access_token"):
        raise AppError(401, "Outlook access ended. Connect it again.", "outlook_reconnect")
    if data.get("refresh_token") and data["refresh_token"] != refresh_token:  # Microsoft rotates these
        await db.save_connection(user_id, **{REFRESH_FIELD: encrypt(data["refresh_token"])})
    return str(data["access_token"])


def _when(dt: datetime, tz: str, utc: bool) -> dict[str, str]:
    if utc:
        return {"dateTime": dt.astimezone(timezone.utc).replace(tzinfo=None).isoformat(), "timeZone": "UTC"}
    return {"dateTime": dt.replace(tzinfo=None).isoformat(), "timeZone": tz}


def to_graph(ev: Ev, tz: str, utc: bool = False) -> dict[str, Any]:
    body: dict[str, Any] = {
        "subject": ev.title,
        "body": {"contentType": "text", "content": ev.description},
        "start": _when(ev.start, tz, utc),
        "end": _when(ev.end, tz, utc),
        # Outlook allows one reminder per event: use the earliest one.
        "isReminderOn": bool(ev.reminders),
        "reminderMinutesBeforeStart": max(ev.reminders) if ev.reminders else 0,
        "showAs": "busy" if ev.busy else "free",
        "singleValueExtendedProperties": [{"id": PROP, "value": ev.key}],
    }
    if ev.until:
        u = ev.until
        body["recurrence"] = {
            "pattern": {"type": "weekly", "interval": 1, "daysOfWeek": [ev.weekday]},
            "range": {"type": "endDate", "startDate": ev.start.date().isoformat(), "endDate": f"{u[:4]}-{u[4:6]}-{u[6:]}"},
        }
    return body


async def _ensure_calendar(client: httpx.AsyncClient, user_id: str, cal_id: str | None) -> str:
    if cal_id:
        r = await client.get(f"{API}/me/calendars/{cal_id}")
        if r.status_code == 200:
            return cal_id
    r = await client.post(f"{API}/me/calendars", json={"name": CAL_NAME})
    if r.status_code == 409:  # one with that name already exists: reuse it
        found = await client.get(f"{API}/me/calendars", params={"$filter": f"name eq '{CAL_NAME}'"})
        items = found.json().get("value", []) if found.status_code == 200 else []
        if items:
            new_id = str(items[0]["id"])
            await db.save_connection(user_id, **{CAL_FIELD: new_id})
            return new_id
    if r.status_code >= 400:
        raise AppError(502, "Couldn't create the Syllabus Planner calendar in Outlook.", "outlook")
    new_id = str(r.json()["id"])
    await db.save_connection(user_id, **{CAL_FIELD: new_id})
    return new_id


async def _existing(client: httpx.AsyncClient, cal_id: str) -> dict[str, str]:
    """Our key -> event id for repeating events and events that haven't ended (past ones are left alone)."""
    found: dict[str, str] = {}
    now = datetime.now(timezone.utc).replace(tzinfo=None).isoformat()
    url: str | None = f"{API}/me/calendars/{cal_id}/events"
    params: dict[str, str] | None = {
        "$top": "200", "$select": "id,end,type",
        "$expand": f"singleValueExtendedProperties($filter=id eq '{PROP}')",
    }
    for _ in range(30):
        if not url:
            break
        r = await client.get(url, params=params, headers={"Prefer": 'outlook.timezone="UTC"'})
        params = None
        if r.status_code >= 400:
            break
        data = r.json()
        for ev in data.get("value", []):
            props = ev.get("singleValueExtendedProperties") or []
            key = props[0].get("value") if props else None
            ended = (ev.get("end") or {}).get("dateTime", "9999") < now
            if key and (ev.get("type") == "seriesMaster" or not ended):
                found[key] = ev["id"]
        url = data.get("@odata.nextLink")
    return found


async def sync(user_id: str, body: SyncIn) -> SyncResult:
    conn = await db.get_connection(user_id)
    refresh = decrypt(conn.get(REFRESH_FIELD))
    if not refresh:
        raise AppError(400, "Connect Outlook first.", "outlook_reconnect")
    token = await access_token(user_id, refresh)
    events = build(body)
    sem = asyncio.Semaphore(4)

    async with httpx.AsyncClient(timeout=20, headers={"Authorization": f"Bearer {token}"}) as client:
        cal_id = await _ensure_calendar(client, user_id, conn.get(CAL_FIELD))
        existing = await _existing(client, cal_id)
        wanted = {e.key for e in events}

        async def send(method: str, url: str, ev: Ev) -> httpx.Response:
            r = await client.request(method, url, json=to_graph(ev, body.time_zone))
            if r.status_code == 400 and "TimeZone" in r.text:  # fall back if the time zone name isn't accepted
                r = await client.request(method, url, json=to_graph(ev, body.time_zone, utc=True))
            return r

        async def put(ev: Ev) -> str:
            async with sem:
                if ev.key in existing:
                    r = await send("PATCH", f"{API}/me/events/{existing[ev.key]}", ev)
                    return "updated" if r.status_code < 400 else "failed"
                r = await send("POST", f"{API}/me/calendars/{cal_id}/events", ev)
                return "created" if r.status_code < 400 else "failed"

        async def drop(event_id: str) -> str:
            async with sem:
                r = await client.delete(f"{API}/me/events/{event_id}")
                return "removed" if r.status_code < 400 or r.status_code == 404 else "failed"

        results = await asyncio.gather(
            *[put(e) for e in events],
            *[drop(eid) for k, eid in existing.items() if k not in wanted],
        )
    return tally(list(results))


async def remove_all(user_id: str) -> bool:
    conn = await db.get_connection(user_id)
    refresh = decrypt(conn.get(REFRESH_FIELD))
    cal_id = conn.get(CAL_FIELD)
    if not refresh or not cal_id:
        return False
    token = await access_token(user_id, refresh)
    async with httpx.AsyncClient(timeout=20, headers={"Authorization": f"Bearer {token}"}) as c:
        r = await c.delete(f"{API}/me/calendars/{cal_id}")
    if r.status_code >= 400 and r.status_code != 404:
        raise AppError(502, "Outlook didn't remove the calendar. Try again.", "outlook")
    await db.save_connection(user_id, **{CAL_FIELD: None})
    return True
