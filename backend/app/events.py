"""Provider-neutral calendar events built from a sync request. Google and Outlook format these."""
from dataclasses import dataclass, field
from datetime import datetime, timedelta

from .schemas import SyncIn

EMOJI = {"study": "\U0001F4DA ", "class": "\U0001F3EB ", "due": "⏰ ", "done": "✅ "}
DAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]


@dataclass
class Ev:
    key: str
    kind: str                  # "due" | "study" | "class"
    title: str
    description: str
    start: datetime            # with offset
    end: datetime
    reminders: list[int] = field(default_factory=list)  # minutes before start
    until: str | None = None   # YYYYMMDD for weekly classes
    busy: bool = True

    @property
    def weekday(self) -> str:
        return DAYS[self.start.weekday()]


def build(body: SyncIn) -> list[Ev]:
    em = (lambda k: EMOJI[k]) if body.emoji else (lambda k: "")
    out: list[Ev] = []

    for d in body.due:
        title = f"{em('done')}Done: {d.title}" if d.done else f"{em('due')}Due: {d.title}"
        out.append(Ev(
            key=d.key, kind="due", title=title,
            description=f"{d.course_code} {d.type}. Added by Syllabus Planner.",
            start=d.due_at - timedelta(minutes=15), end=d.due_at,
            reminders=[] if d.done else [max(0, min(40320, m)) for m in d.reminders_min[:5]],
            busy=False,
        ))

    for s in body.study:
        desc = ("Study for: " + "; ".join(s.study_for)) if s.study_for else \
            "Nothing picked yet. Open this block in Syllabus Planner and star what you'll work on."
        out.append(Ev(key=s.key, kind="study", title=f"{em('study')}Study: {s.course_code}",
                      description=desc, start=s.start, end=s.end, reminders=[10]))

    for c in body.classes:
        out.append(Ev(key=c.key, kind="class", title=f"{em('class')}Class: {c.course_code} {c.course_name}".strip(),
                      description="In-person class meeting. Added by Syllabus Planner.",
                      start=c.first_start, end=c.first_end, until=c.until))
    return out
