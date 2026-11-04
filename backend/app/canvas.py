"""Canvas access: personal access token (REST API) or calendar feed (ICS)."""
import re
from datetime import date, datetime, time, timezone
from typing import Any
from urllib.parse import urlparse

import httpx
from icalendar import Calendar

from .errors import AppError

ALLOWED_HOST_SUFFIX = ".instructure.com"


def safe_canvas_url(url: str) -> str:
    """Only allow HTTPS Canvas hosts, so the server can't be tricked into fetching other sites."""
    p = urlparse(url)
    host = (p.hostname or "").lower()
    if p.scheme != "https" or not (host.endswith(ALLOWED_HOST_SUFFIX)):
        raise AppError(400, "Use your school's Canvas address (https://…instructure.com).", "bad_url")
    return url


def guess_type(title: str, submission_types: list[str] | None = None) -> str:
    t = title.lower()
    subs = submission_types or []
    if "online_quiz" in subs or re.search(r"\bquiz|\bchallenge\b", t):
        return "quiz"
    if re.search(r"\b(exam|midterm|final|test)\b", t):
        return "exam"
    if re.search(r"\b(project|checkpoint|milestone)\b", t):
        return "project"
    if re.search(r"\b(read|reading|chapter)\b", t):
        return "reading"
    if "none" in subs or "not_graded" in subs:
        return "other"
    return "assignment"


def short_code(course_code: str) -> str:
    """'CSE 325 - Section 1 (Fall 2026)' -> 'CSE 325'."""
    m = re.match(r"\s*([A-Z]{2,5})\s?-?\s?(\d{3}[A-Z]?)", course_code or "")
    return f"{m.group(1)} {m.group(2)}" if m else (course_code or "Class")[:20].strip()


def _next_link(link_header: str | None) -> str | None:
    if not link_header:
        return None
    for part in link_header.split(","):
        if 'rel="next"' in part:
            return part[part.find("<") + 1 : part.find(">")]
    return None


async def _get_all(client: httpx.AsyncClient, url: str, params: dict[str, Any]) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    next_url: str | None = url
    first = True
    pages = 0
    while next_url and pages < 20:
        r = await client.get(next_url, params=params if first else None)
        first = False
        pages += 1
        if r.status_code == 401:
            raise AppError(401, "Canvas didn't accept that token. Make a new one in Canvas > Account > Settings.", "canvas_token")
        if r.status_code >= 400:
            raise AppError(502, "Canvas didn't respond. Try again in a moment.", "canvas")
        out.extend(r.json())
        next_url = _next_link(r.headers.get("link"))
    return out


def _client(base_url: str, token: str) -> httpx.AsyncClient:
    return httpx.AsyncClient(base_url=base_url, timeout=20, headers={"Authorization": f"Bearer {token}"})


async def check_token(base_url: str, token: str) -> str:
    async with _client(base_url, token) as c:
        r = await c.get("/api/v1/users/self")
    if r.status_code != 200:
        raise AppError(400, "Canvas didn't accept that token. Check it and try again.", "canvas_token")
    return str(r.json().get("name", ""))


async def fetch_courses_and_assignments(base_url: str, token: str) -> list[dict[str, Any]]:
    """Returns [{canvas_id, code, name, syllabus_html, items: [...]}] for active courses."""
    async with _client(base_url, token) as c:
        courses = await _get_all(
            c,
            "/api/v1/courses",
            {"enrollment_state": "active", "include[]": "syllabus_body", "per_page": "50"},
        )
        result = []
        for course in courses:
            if course.get("access_restricted_by_date"):
                continue
            cid = course["id"]
            assignments = await _get_all(
                c, f"/api/v1/courses/{cid}/assignments", {"per_page": "100", "order_by": "due_date", "include[]": "submission"}
            )
            result.append(
                {
                    "canvas_id": str(cid),
                    "code": short_code(course.get("course_code", "")),
                    "name": course.get("name", ""),
                    "syllabus_html": course.get("syllabus_body") or "",
                    "items": [map_assignment(a) for a in assignments if a.get("published", True)],
                    "submitted": [str(a["id"]) for a in assignments if submitted(a)],
                }
            )
        return result


def submitted(a: dict[str, Any]) -> bool:
    sub = a.get("submission") or {}
    return sub.get("workflow_state") in ("submitted", "graded", "pending_review")


def map_assignment(a: dict[str, Any]) -> dict[str, Any]:
    return {
        "canvas_id": str(a["id"]),
        "title": (a.get("name") or "Untitled").strip()[:300],
        "type": guess_type(a.get("name") or "", a.get("submission_types")),
        "due_at": a.get("due_at"),  # ISO in UTC, or None
        "source": "canvas",
        "confidence": 1.0 if a.get("due_at") else 0.6,
    }


# ---------- Calendar feed (ICS) ----------

_BRACKET = re.compile(r"\s*\[([^\]]+)\]\s*$")


def parse_ics(text: str) -> list[dict[str, Any]]:
    """Canvas feed events look like 'Title [CSE 325 Section 1]'. Group by the bracket."""
    cal = Calendar.from_ical(text)
    courses: dict[str, dict[str, Any]] = {}
    for ev in cal.walk("VEVENT"):
        summary = str(ev.get("SUMMARY", "")).strip()
        uid = str(ev.get("UID", ""))
        dt = ev.get("DTSTART")
        if not summary or dt is None:
            continue
        m = _BRACKET.search(summary)
        course_label = m.group(1) if m else "Canvas"
        title = _BRACKET.sub("", summary)
        start = dt.dt
        if isinstance(start, date) and not isinstance(start, datetime):
            start = datetime.combine(start, time(23, 59), tzinfo=timezone.utc)
        elif start.tzinfo is None:
            start = start.replace(tzinfo=timezone.utc)
        code = short_code(course_label)
        course = courses.setdefault(code, {"canvas_id": f"ics:{code}", "code": code, "name": course_label, "syllabus_html": "", "items": []})
        course["items"].append(
            {
                "canvas_id": f"ics:{uid}"[:200],
                "title": title[:300],
                "type": guess_type(title),
                "due_at": start.isoformat(),
                "source": "canvas",
                "confidence": 0.9,
            }
        )
    return list(courses.values())


async def fetch_feed(url: str) -> list[dict[str, Any]]:
    safe_canvas_url(url)
    async with httpx.AsyncClient(timeout=20, follow_redirects=False) as c:
        r = await c.get(url)
    if r.status_code != 200 or "BEGIN:VCALENDAR" not in r.text[:200]:
        raise AppError(400, "That link didn't return a Canvas calendar feed.", "bad_feed")
    return parse_ics(r.text)
