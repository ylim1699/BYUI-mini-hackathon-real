"""Vercel entrypoint (vercel.json: "entrypoint": "main:app").

Local dev:  uvicorn main:app --reload --port 8000
"""
from app.main import app

__all__ = ["app"]
