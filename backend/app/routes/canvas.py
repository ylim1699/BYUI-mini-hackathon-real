from typing import Any

from fastapi import APIRouter, Depends

from .. import canvas as cv
from .. import db
from ..auth import User, current_user
from ..config import get_settings
from ..crypto import decrypt, encrypt
from ..errors import AppError
from ..schemas import CanvasConnect, ImportResult

router = APIRouter(prefix="/canvas")

COLORS = ["c1", "c2", "c3", "c4", "c5", "c6", "c7", "c8"]


@router.post("/connect")
async def connect(body: CanvasConnect, user: User = Depends(current_user)) -> dict[str, str]:
    base = cv.safe_canvas_url(get_settings().canvas_base_url)
    if body.token:
        name = await cv.check_token(base, body.token.strip())
        await db.save_connection(user.id, canvas_base_url=base, canvas_token_enc=encrypt(body.token.strip()))
        return {"connected": "token", "name": name}
    if body.feed_url:
        url = cv.safe_canvas_url(str(body.feed_url))
        await db.save_connection(user.id, canvas_ics_enc=encrypt(url))
        return {"connected": "feed", "name": ""}
    raise AppError(400, "Paste a Canvas access token or a calendar feed link.", "missing")


@router.post("/disconnect")
async def disconnect(user: User = Depends(current_user)) -> dict[str, bool]:
    await db.save_connection(user.id, canvas_token_enc=None, canvas_ics_enc=None)
    return {"ok": True}


@router.post("/import", response_model=ImportResult)
async def import_canvas(user: User = Depends(current_user)) -> ImportResult:
    conn = await db.get_connection(user.id)
    token = decrypt(conn.get("canvas_token_enc"))
    feed = decrypt(conn.get("canvas_ics_enc"))
    if token:
        courses = await cv.fetch_courses_and_assignments(conn.get("canvas_base_url") or get_settings().canvas_base_url, token)
        source = "token"
    elif feed:
        courses = await cv.fetch_feed(feed)
        source = "feed"
    else:
        raise AppError(400, "Connect Canvas first.", "canvas_missing")

    # Keep the student's own edits (renamed classes, colors) on re-import.
    existing = {
        r["canvas_id"]: r["id"]
        for r in await db.select("courses", {"user_id": f"eq.{user.id}", "select": "id,canvas_id"})
    }
    n_items = 0
    for i, c in enumerate(courses):
        course_id = existing.get(c["canvas_id"])
        if not course_id:
            saved = await db.upsert(
                "courses",
                {
                    "user_id": user.id,
                    "canvas_id": c["canvas_id"],
                    "code": c["code"],
                    "name": c["name"][:120],
                    "color": COLORS[(len(existing) + i) % len(COLORS)],
                    "credits": 3,
                    "hours_per_week": 7.5,
                    "source": "canvas",
                },
                "user_id,canvas_id",
            )
            course_id = saved[0]["id"]
        rows: list[dict[str, Any]] = [
            {**it, "user_id": user.id, "course_id": course_id} for it in c["items"]
        ]
        if rows:
            await db.upsert("items", rows, "user_id,course_id,canvas_id")
            n_items += len(rows)
    return ImportResult(courses=len(courses), items=n_items, source=source)  # type: ignore[arg-type]


@router.get("/syllabus/{canvas_course_id}")
async def syllabus_text(canvas_course_id: str, user: User = Depends(current_user)) -> dict[str, str]:
    """Plain text of a course's Canvas syllabus page, for /api/syllabus/parse."""
    from ..sanitize import html_to_text

    conn = await db.get_connection(user.id)
    token = decrypt(conn.get("canvas_token_enc"))
    if not token:
        raise AppError(400, "Reading the syllabus needs a Canvas access token.", "canvas_missing")
    if not canvas_course_id.isdigit():
        raise AppError(400, "Unknown course.", "bad_id")
    base = conn.get("canvas_base_url") or get_settings().canvas_base_url
    async with cv._client(base, token) as c:  # noqa: SLF001
        r = await c.get(f"/api/v1/courses/{canvas_course_id}", params={"include[]": "syllabus_body"})
    if r.status_code != 200:
        raise AppError(502, "Couldn't read that syllabus from Canvas.", "canvas")
    return {"text": html_to_text(r.json().get("syllabus_body") or "")}
