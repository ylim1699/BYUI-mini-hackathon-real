import pytest

from app.canvas import guess_type, map_assignment, parse_ics, safe_canvas_url, short_code
from app.errors import AppError

ICS = """BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Canvas
BEGIN:VEVENT
UID:event-assignment-1
DTSTART:20261108T065900Z
DTEND:20261108T065900Z
SUMMARY:U04 Blazor assignment [CSE 325 Section 1]
END:VEVENT
BEGIN:VEVENT
UID:event-assignment-2
DTSTART;VALUE=DATE:20261112
SUMMARY:W09 Midterm exam [CSE 280-01 Discrete Math]
END:VEVENT
END:VCALENDAR
"""


def test_guess_type():
    assert guess_type("W08 Midterm exam") == "exam"
    assert guess_type("Reading quiz 3") == "quiz"
    assert guess_type("Anything", ["online_quiz"]) == "quiz"
    assert guess_type("U04 Project Checkpoint 2") == "project"
    assert guess_type("Read chapter 4") == "reading"
    assert guess_type("W08 Teaching Truth post") == "assignment"


def test_short_code():
    assert short_code("CSE 325 - Section 1") == "CSE 325"
    assert short_code("REL212") == "REL 212"
    assert short_code("CSE 280-01 Discrete Math") == "CSE 280"


def test_safe_url():
    assert safe_canvas_url("https://byui.instructure.com/feeds/x.ics")
    for bad in ["http://byui.instructure.com", "https://evil.com", "https://instructure.com.evil.io/x", "file:///etc/passwd"]:
        with pytest.raises(AppError):
            safe_canvas_url(bad)


def test_parse_ics_groups_by_course():
    courses = {c["code"]: c for c in parse_ics(ICS)}
    assert set(courses) == {"CSE 325", "CSE 280"}
    item = courses["CSE 325"]["items"][0]
    assert item["title"] == "U04 Blazor assignment"
    assert item["due_at"].startswith("2026-11-08T06:59")
    assert courses["CSE 280"]["items"][0]["type"] == "exam"
    assert courses["CSE 280"]["items"][0]["due_at"].startswith("2026-11-12T23:59")


def test_map_assignment_without_date_is_low_confidence():
    it = map_assignment({"id": 5, "name": "Peer review", "due_at": None, "submission_types": ["online_text_entry"]})
    assert it["due_at"] is None and it["confidence"] < 0.7
