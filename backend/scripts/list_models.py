"""Lists the Gemini models your GEMINI_API_KEY can use for text, and checks the ones in .env.

Run from the backend folder with the venv on:  python scripts/list_models.py
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from google import genai  # noqa: E402

from app.config import get_settings  # noqa: E402

s = get_settings()
if not s.gemini_api_key:
    sys.exit("GEMINI_API_KEY isn't set in .env")
client = genai.Client(api_key=s.gemini_api_key)
names = []
for m in client.models.list():
    actions = getattr(m, "supported_actions", None) or []
    if "generateContent" in actions and "gemini" in (m.name or ""):
        names.append((m.name or "").removeprefix("models/"))
print("Models your key can use for text:")
for n in sorted(names):
    print("  ", n)
print("\nYour settings (tried in this order):")
for n in s.gemini_models:
    print("  ", n, "OK" if n in names else "<- NOT available, pick one from the list above")
