from app.google_cal import build_events
from app.schemas import SyncIn


def body(emoji=True):
    return SyncIn.model_validate({
        "time_zone": "America/Denver",
        "emoji": emoji,
        "due": [{"key": "due|1", "title": "U04 Blazor assignment", "course_code": "CSE 325", "type": "assignment",
                 "due_at": "2026-11-07T23:59:00-07:00", "reminders_min": [2880, 180]}],
        "study": [{"key": "study|2026-11-03|18|c1", "course_code": "CSE 325",
                   "start": "2026-11-03T18:00:00-07:00", "end": "2026-11-03T21:00:00-07:00",
                   "study_for": ["U04 Blazor assignment (due Sat, Nov 7)"]},
                  {"key": "study|2026-11-04|15|c3", "course_code": "REL 212",
                   "start": "2026-11-04T15:00:00-07:00", "end": "2026-11-04T17:00:00-07:00"}],
        "classes": [{"key": "class|c2|1", "course_code": "CSE 280", "course_name": "Discrete Mathematics",
                     "first_start": "2026-11-02T09:45:00-07:00", "first_end": "2026-11-02T10:45:00-07:00", "until": "20261216"}],
    })


def test_titles_and_notes():
    ev = dict(build_events(body()))
    assert ev["due|1"]["summary"] == "⏰ Due: U04 Blazor assignment"
    assert [o["minutes"] for o in ev["due|1"]["reminders"]["overrides"]] == [2880, 180]
    assert ev["study|2026-11-03|18|c1"]["summary"] == "\U0001F4DA Study: CSE 325"
    assert ev["study|2026-11-03|18|c1"]["description"] == "Study for: U04 Blazor assignment (due Sat, Nov 7)"
    assert ev["study|2026-11-04|15|c3"]["description"].startswith("Nothing picked yet")
    assert ev["class|c2|1"]["summary"] == "\U0001F3EB Class: CSE 280 Discrete Mathematics"
    assert ev["class|c2|1"]["recurrence"] == ["RRULE:FREQ=WEEKLY;UNTIL=20261216T235959Z"]
    for e in ev.values():
        assert e["extendedProperties"]["private"]["syllabusPlanner"] == "1"


def test_emoji_off():
    ev = dict(build_events(body(emoji=False)))
    assert ev["due|1"]["summary"] == "Due: U04 Blazor assignment"


def test_done_item_is_checked_and_silent():
    b = body()
    b.due[0].done = True
    ev = dict(build_events(b))
    assert ev["due|1"]["summary"] == "\u2705 Done: U04 Blazor assignment"
    assert ev["due|1"]["reminders"]["overrides"] == []
