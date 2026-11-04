from fastapi.testclient import TestClient

from app.main import app
from app.sanitize import clean_html, html_to_text

client = TestClient(app)


def test_health():
    r = client.get("/api/health")
    assert r.status_code == 200 and r.json()["ok"] is True


def test_routes_need_login():
    for path in ["/api/me", "/api/canvas/import", "/api/summary", "/api/google/sync", "/api/google/start", "/api/outlook/sync", "/api/outlook/start"]:
        r = client.post(path, json={}) if path != "/api/me" else client.get(path)
        assert r.status_code == 401, path


def test_sanitize():
    assert "<script" not in clean_html('<p onclick="x()">Hi</p><script>alert(1)</script>')
    assert html_to_text("<p>Week 1</p><p>Read <b>ch 1</b></p>") == "Week 1\nRead ch 1"


def test_callback_without_code_goes_back_to_app():
    r = client.get("/api/outlook/callback?error=access_denied", follow_redirects=False)
    assert r.status_code == 302 and r.headers["location"].endswith("/sync?calendar=outlook&result=cancelled")
    r = client.get("/api/google/callback?code=x&state=forged", follow_redirects=False)
    assert r.headers["location"].endswith("result=error")
