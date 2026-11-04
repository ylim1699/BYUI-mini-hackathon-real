from cryptography.fernet import Fernet, InvalidToken

from .config import get_settings
from .errors import AppError


def _fernet() -> Fernet:
    key = get_settings().encryption_key
    if not key:
        raise AppError(500, "Server is missing ENCRYPTION_KEY.", "config")
    return Fernet(key.encode())


def encrypt(value: str) -> str:
    return _fernet().encrypt(value.encode()).decode()


def decrypt(value: str | None) -> str | None:
    if not value:
        return None
    try:
        return _fernet().decrypt(value.encode()).decode()
    except InvalidToken:
        # Key was rotated or data is corrupt: treat as not connected.
        return None
