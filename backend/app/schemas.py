"""Pydantic models. Mirror frontend/src/types/domain.ts field for field."""
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field, HttpUrl

ItemType = Literal["assignment", "quiz", "exam", "project", "reading", "other"]


class Meeting(BaseModel):
    day: int = Field(ge=0, le=6)  # 0 = Sunday
    start: str = Field(pattern=r"^\d{2}:\d{2}$")
    end: str = Field(pattern=r"^\d{2}:\d{2}$")


# ---------- Canvas ----------

class CanvasConnect(BaseModel):
    token: str | None = Field(default=None, min_length=20, max_length=200)
    feed_url: HttpUrl | None = None


class ImportResult(BaseModel):
    courses: int
    items: int
    source: Literal["token", "feed"]


# ---------- Syllabus ----------

class SyllabusParseIn(BaseModel):
    text: str = Field(min_length=50, max_length=60_000)
    course_code: str | None = Field(default=None, max_length=40)
    semester_start: str | None = Field(default=None, pattern=r"^\d{4}-\d{2}-\d{2}$")


class ParsedItem(BaseModel):
    title: str
    type: ItemType
    due_date: str | None = Field(default=None, description="YYYY-MM-DD, or null if unknown")
    due_time: str | None = Field(default=None, description="HH:MM 24h, or null")
    confidence: float = Field(ge=0, le=1)
    note: str | None = Field(default=None, description="Why this item is uncertain, if it is")


class ParsedSyllabus(BaseModel):
    course_code: str | None = None
    course_name: str | None = None
    credits: float | None = None
    online: bool | None = None
    meetings: list[Meeting] = []
    items: list[ParsedItem] = []


# ---------- Google sync ----------

class GoogleLink(BaseModel):
    refresh_token: str = Field(min_length=10, max_length=600)


class SyncDue(BaseModel):
    key: str = Field(max_length=200)
    title: str = Field(max_length=300)
    course_code: str = Field(max_length=40)
    type: ItemType
    due_at: datetime
    done: bool = False                        # done items stay, marked with a check, no reminders
    reminders_min: list[int] = Field(default=[], max_length=5)


class SyncStudy(BaseModel):
    key: str = Field(max_length=200)          # "2026-11-03|18|<courseId>"
    course_code: str = Field(max_length=40)
    start: datetime
    end: datetime
    study_for: list[str] = Field(default=[], max_length=20)  # "U04 Blazor assignment (due Sat, Nov 7)"


class SyncClass(BaseModel):
    key: str = Field(max_length=200)
    course_code: str = Field(max_length=40)
    course_name: str = Field(default="", max_length=120)
    first_start: datetime                     # first occurrence, local time with offset
    first_end: datetime
    until: str = Field(pattern=r"^\d{8}$")    # YYYYMMDD, last day of the semester


class SyncIn(BaseModel):
    time_zone: str = Field(max_length=60)     # e.g. "America/Denver"
    emoji: bool = True
    due: list[SyncDue] = Field(default=[], max_length=400)
    study: list[SyncStudy] = Field(default=[], max_length=200)
    classes: list[SyncClass] = Field(default=[], max_length=40)


class SyncResult(BaseModel):
    created: int
    updated: int
    removed: int
    failed: int
    calendar_name: str


# ---------- Summary ----------

class SummaryItem(BaseModel):
    id: str = Field(max_length=200)
    title: str = Field(max_length=300)
    course_code: str = Field(max_length=40)
    type: ItemType
    due_at: datetime
    done: bool = False


class SummaryIn(BaseModel):
    range: Literal["day", "week"]
    today: str = Field(pattern=r"^\d{4}-\d{2}-\d{2}$")
    items: list[SummaryItem] = Field(default=[], max_length=150)
    study_hours: dict[str, float] = Field(default={})  # course_code -> hours this range


class SummaryBullet(BaseModel):
    text: str
    item_id: str | None = None
    priority: Literal["high", "normal"] = "normal"


class Summary(BaseModel):
    headline: str
    bullets: list[SummaryBullet]
