from fastapi import HTTPException


class AppError(HTTPException):
    """An error with a message that is safe to show the student."""

    def __init__(self, status: int, message: str, code: str = "error") -> None:
        super().__init__(status_code=status, detail={"code": code, "message": message})
