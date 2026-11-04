import pytest

from app import google_cal, outlook
from app.errors import AppError
from app.oauth import make_state, read_state


def test_state_round_trip_and_provider_check():
    s = make_state("user-1", "google")
    assert read_state(s, "google") == "user-1"
    with pytest.raises(AppError):
        read_state(s, "outlook")
    with pytest.raises(AppError):
        read_state("forged", "google")


def test_auth_urls_point_back_to_api():
    g = google_cal.auth_url("st")
    assert "calendar.app.created" in g and "access_type=offline" in g and "%2Fapi%2Fgoogle%2Fcallback" in g
    o = outlook.auth_url("st")
    assert "Calendars.ReadWrite" in o and "%2Fapi%2Foutlook%2Fcallback" in o
