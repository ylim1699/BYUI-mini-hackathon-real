"""Google Calendar sync into a separate 'Syllabus Planner' calendar.

Scope: https://www.googleapis.com/auth/calendar.app.created
(lets the app create its own calendar and manage events in it, nothing else).
"""
import asyncio
from datetime import datetime, timedelta, timezone
from typing import Any

import httpx

from . import db
from .config import get_settings
from .crypto import decrypt
from .errors import AppError
from .schemas import SyncIn, SyncResult

API = "https://www.googleapis.com/calendar/v3"
CAL_NAME = "Syllabus Planner"
TAG = "syllabusPlanner"

EMOJI = {"study": "\U0001F4DA ", "class": "\U0001F3EB ", "due": "\u23F0 ", "done": "\u2705 "}


async def access_token(refresh_token: str) -> str:
    s = get_settings()
    async with httpx.AsyncClient(timeout=15) as c:
        r = await c.post(
            "https://oauth2.googleapis.com/token",
            data={
                "client_id": s.google_client_id,
                "client_secret": s.google_client_secret,
                "refresh_token": refresh_token,
                "grant_type": "refresh_token",
            },
        )
    if r.status_code != 200:
        raise AppError(401, "Google access expired. Sign out and sign in with Google again.", "google_reconnect")
    return str(r.json()["access_token"])


def build_events(body: SyncIn) -> list[tuple[str, dict[str, Any]]]:
    """Pure: turns the sync request into (key, Google event body) pairs."""
    tz = body.time_zone
    em = (lambda k: EMOJI[k]) if body.emoji else (lambda k: "")
    out: list[tuple[str, dict[str, Any]]] = []

    def tag(key: str) -> dict[str, Any]:
        return {"private": {TAG: "1", "spKey": key}}

    for d in body.due:
        start = d.due_at - timedelta(minutes=15)
        label = f"{em('done')}Done: {d.title}" if d.done else f"{em('due')}Due: {d.title}"
        out.append((d.key, {
            "summary": label,
            "description": f"{d.course_code} {d.type}. Added by Syllabus Planner.",
            "start": {"dateTime": start.isoformat(), "timeZone": tz},
            "end": {"dateTime": d.due_at.isoformat(), "timeZone": tz},
            "reminders": {"useDefault": False, "overrides": [
                {"method": "popup", "minutes": max(0, min(40320, m))} for m in ([] if d.done else d.reminders_min[:5])
            ]},
            "transparency": "transparent",
            "extendedProperties": tag(d.key),
        }))

    for s in body.study:
        desc = ("Study for: " + "; ".join(s.study_for)) if s.study_for else \
            "Nothing picked yet. Open this block in Syllabus Planner and star what you'll work on."
        out.append((s.key, {
            "summary": f"{em('study')}Study: {s.course_code}",
            "description": desc,
            "start": {"dateTime": s.start.isoformat(), "timeZone": tz},
            "end": {"dateTime": s.end.isoformat(), "timeZone": tz},
            "reminders": {"useDefault": False, "overrides": [{"method": "popup", "minutes": 10}]},
            "extendedProperties": tag(s.key),
        }))

    for c in body.classes:
        out.append((c.key, {
            "summary": f"{em('class')}Class: {c.course_code} {c.course_name}".strip(),
            "description": "In-person class meeting. Added by Syllabus Planner.",
            "start": {"dateTime": c.first_start.isoformat(), "timeZone": tz},
            "end": {"dateTime": c.first_end.isoformat(), "timeZone": tz},
            "recurrence": [f"RRULE:FREQ=WEEKLY;UNTIL={c.until}T235959Z"],
            "reminders": {"useDefault": False, "overrides": []},
            "extendedProperties": tag(c.key),
        }))
    return out


async def _ensure_calendar(client: httpx.AsyncClient, user_id: str, cal_id: str | None, tz: str) -> str:
    if cal_id:
        r = await client.get(f"{API}/calendars/{cal_id}")
        if r.status_code == 200:
            return cal_id
    r = await client.post(f"{API}/calendars", json={"summary": CAL_NAME, "timeZone": tz})
    if r.status_code >= 400:
        raise AppError(502, "Couldn't create the Syllabus Planner calendar in Google.", "google")
    new_id = str(r.json()["id"])
    await db.save_connection(user_id, google_calendar_id=new_id)
    return new_id


async def _existing(client: httpx.AsyncClient, cal_id: str) -> dict[str, str]:
    """Maps our key -> Google event id for upcoming events we created (past events are left alone)."""
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
    refresh = decrypt(conn.get("google_refresh_enc"))
    if not refresh:
        raise AppError(400, "Connect Google Calendar first: sign out and sign in with Google again.", "google_reconnect")
    token = await access_token(refresh)

    events = build_events(body)
    created = updated = removed = failed = 0
    sem = asyncio.Semaphore(5)

    async with httpx.AsyncClient(timeout=20, headers={"Authorization": f"Bearer {token}"}) as client:
        cal_id = await _ensure_calendar(client, user_id, conn.get("google_calendar_id"), body.time_zone)
        existing = await _existing(client, cal_id)
        wanted = {k for k, _ in events}

        async def put(key: str, ev: dict[str, Any]) -> str:
            async with sem:
                if key in existing:
                    r = await client.put(f"{API}/calendars/{cal_id}/events/{existing[key]}", json=ev)
                    return "updated" if r.status_code < 400 else "failed"
                r = await client.post(f"{API}/calendars/{cal_id}/events", json=ev)
                return "created" if r.status_code < 400 else "failed"

        async def drop(event_id: str) -> str:
            async with sem:
                r = await client.delete(f"{API}/calendars/{cal_id}/events/{event_id}")
                return "removed" if r.status_code < 400 or r.status_code == 410 else "failed"

        results = await asyncio.gather(
            *[put(k, ev) for k, ev in events],
            *[drop(eid) for k, eid in existing.items() if k not in wanted],
        )
    for r in results:
        if r == "created":
            created += 1
        elif r == "updated":
            updated += 1
        elif r == "removed":
            removed += 1
        else:
            failed += 1
    return SyncResult(created=created, updated=updated, removed=removed, failed=failed, calendar_name=CAL_NAME)


async def remove_all(user_id: str) -> bool:
    """Deletes the whole 'Syllabus Planner' calendar: everything this app added, nothing else."""
    conn = await db.get_connection(user_id)
    refresh = decrypt(conn.get("google_refresh_enc"))
    cal_id = conn.get("google_calendar_id")
    if not refresh or not cal_id:
        return False
    token = await access_token(refresh)
    async with httpx.AsyncClient(timeout=20, headers={"Authorization": f"Bearer {token}"}) as c:
        r = await c.delete(f"{API}/calendars/{cal_id}")
    if r.status_code >= 400 and r.status_code not in (404, 410):
        raise AppError(502, "Google didn't remove the calendar. Try again.", "google")
    await db.save_connection(user_id, google_calendar_id=None)
    return True
