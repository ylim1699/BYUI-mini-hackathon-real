"""Signed, short-lived OAuth state: ties the calendar a person connects to their own session."""
import json
import secrets
import time

from cryptography.fernet import Fernet, InvalidToken

from .config import get_settings
from .errors import AppError

MAX_AGE = 600  # seconds


def make_state(user_id: str, provider: str) -> str:
    raw = json.dumps({"u": user_id, "p": provider, "n": secrets.token_urlsafe(8)})
    return Fernet(get_settings().encryption_key.encode()).encrypt(raw.encode()).decode()


def read_state(state: str, provider: str) -> str:
    """Returns the user id, or raises if the state is forged, expired, or for another provider."""
    try:
        raw = Fernet(get_settings().encryption_key.encode()).decrypt(state.encode(), ttl=MAX_AGE)
        data = json.loads(raw)
    except (InvalidToken, ValueError):
        raise AppError(400, "That connection link expired. Try connecting again.", "bad_state")
    if data.get("p") != provider or not data.get("u"):
        raise AppError(400, "That connection link isn't valid. Try connecting again.", "bad_state")
    return str(data["u"])


def now() -> float:
    return time.time()
