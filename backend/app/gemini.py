"""Gemini calls with JSON-schema output. Only titles, dates, and syllabus text are sent."""
from datetime import date

from pydantic import BaseModel

from . import db
from .config import get_settings
from .errors import AppError
from .schemas import ParsedSyllabus, Summary, SummaryIn


async def check_quota(user_id: str) -> None:
    day = date.today().isoformat()
    total = await db.rpc("bump_ai_global", {"p_day": day})
    if isinstance(total, int) and total > get_settings().ai_global_daily_limit:
        raise AppError(429, "The app's AI limit for today is used up. It resets tomorrow.", "ai_limit")
    count = await db.rpc("bump_ai_usage", {"p_user": user_id, "p_day": day})
    if isinstance(count, int) and count > get_settings().ai_daily_limit:
        raise AppError(429, "You've used today's AI limit. It resets tomorrow.", "ai_limit")


async def _generate(prompt: str, schema: type[BaseModel]) -> BaseModel:
    s = get_settings()
    if not s.gemini_api_key:
        raise AppError(503, "AI isn't set up on the server yet.", "config")
    from google import genai
    from google.genai import types

    client = genai.Client(api_key=s.gemini_api_key)
    try:
        resp = await client.aio.models.generate_content(
            model=s.gemini_model,
            contents=prompt,
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                response_schema=schema,
                temperature=0.2,
            ),
        )
    except Exception as e:  # network, quota, safety
        msg = str(e)
        if "429" in msg or "RESOURCE_EXHAUSTED" in msg:
            raise AppError(429, "The free AI quota is used up for now. Try again later.", "ai_quota")
        raise AppError(502, "The AI service didn't respond. Try again.", "ai")
    if resp.parsed is not None:
        return resp.parsed  # type: ignore[return-value]
    return schema.model_validate_json(resp.text or "{}")


SYLLABUS_PROMPT = """You extract a course schedule from a college syllabus.
Return only what the text supports. Never invent dates.
- items: every graded or scheduled piece of work (assignments, quizzes, exams, projects, readings).
  due_date as YYYY-MM-DD when a real date is given; if only "Week 7" style is given and a semester start is known, compute it, otherwise null.
  confidence below 0.7 when the date, title, or type is unclear, and say why in note.
- meetings: in-person class meeting days and times (0=Sunday). Empty if online or unknown.
- online: true if the course is online-only, false if it meets in person, null if unclear.
- meeting_days_text: what the syllabus says about meeting days/times, even if no exact times.
- credits and weekly_hours only when stated. late_policy in under 12 words.
- notes: 1-2 short sentences on what's missing or assumed (for example "Class times aren't listed").
- source_lines: up to 6 short quotes from the syllabus; highlight=true for lines where you found dates or class times.
- hours: rough hours of work per item when you can estimate it (exam 3, project 3, assignment 2, quiz 0.5, reading 1).
Semester start: {semester_start}
Course code hint: {code}

SYLLABUS TEXT:
{text}
"""


async def parse_syllabus(text: str, code: str | None, semester_start: str | None) -> ParsedSyllabus:
    prompt = SYLLABUS_PROMPT.format(text=text[:60_000], code=code or "unknown", semester_start=semester_start or "unknown")
    return await _generate(prompt, ParsedSyllabus)  # type: ignore[return-value]


SUMMARY_PROMPT = """You are a calm, practical study planner for a college student.
Write a summary for {scope} (today is {today}).
Rules: use only the items below; never invent assignments or dates; plain sentence case; at most 5 bullets;
put the most urgent first and mark it high priority; reference an item by its id in item_id when a bullet is about it.
Headline: one short sentence.

Items (id | class | type | title | due | done):
{items}

Study time set aside this {scope_word} (hours by class): {study}
"""


async def summarize(body: SummaryIn) -> Summary:
    lines = "\n".join(
        f"{i.id} | {i.course_code} | {i.type} | {i.title} | {i.due_at.isoformat()} | {'done' if i.done else 'not done'}"
        for i in body.items
    ) or "(nothing due)"
    prompt = SUMMARY_PROMPT.format(
        scope="today" if body.range == "day" else "this week",
        scope_word="day" if body.range == "day" else "week",
        today=body.today,
        items=lines,
        study=", ".join(f"{k}: {v}" for k, v in body.study_hours.items()) or "none",
    )
    return await _generate(prompt, Summary)  # type: ignore[return-value]
