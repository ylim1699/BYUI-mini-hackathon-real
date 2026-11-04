"""Tiny Supabase (PostgREST) client using the service role key.

The service key bypasses row-level security, so EVERY query here must filter by user_id.
"""
from typing import Any

import httpx

from .config import get_settings
from .errors import AppError


def _headers(extra: dict[str, str] | None = None) -> dict[str, str]:
    key = get_settings().supabase_service_role_key
    h = {"apikey": key, "Content-Type": "application/json"}
    # Legacy service_role keys are JWTs and go in Authorization too. New "sb_secret_..." keys
    # aren't JWTs: they go only in the apikey header and Supabase handles the rest.
    if key.startswith("eyJ"):
        h["Authorization"] = f"Bearer {key}"
    if extra:
        h.update(extra)
    return h


def _url(path: str) -> str:
    return f"{get_settings().supabase_url}/rest/v1/{path}"


def _check(r: httpx.Response) -> Any:
    if r.status_code >= 400:
        raise AppError(502, "Database request failed. Try again in a moment.", "db")
    return r.json() if r.content else None


async def select(table: str, params: dict[str, str]) -> list[dict[str, Any]]:
    async with httpx.AsyncClient(timeout=15) as c:
        return _check(await c.get(_url(table), params=params, headers=_headers())) or []


async def upsert(table: str, rows: list[dict[str, Any]] | dict[str, Any], on_conflict: str) -> list[dict[str, Any]]:
    async with httpx.AsyncClient(timeout=20) as c:
        r = await c.post(
            _url(table),
            params={"on_conflict": on_conflict},
            json=rows,
            headers=_headers({"Prefer": "resolution=merge-duplicates,return=representation"}),
        )
    return _check(r) or []


async def update(table: str, params: dict[str, str], values: dict[str, Any]) -> list[dict[str, Any]]:
    async with httpx.AsyncClient(timeout=15) as c:
        r = await c.patch(_url(table), params=params, json=values, headers=_headers({"Prefer": "return=representation"}))
    return _check(r) or []


async def rpc(fn: str, args: dict[str, Any]) -> Any:
    async with httpx.AsyncClient(timeout=10) as c:
        return _check(await c.post(_url(f"rpc/{fn}"), json=args, headers=_headers()))


# ---- connections (encrypted credentials) ----

async def get_connection(user_id: str) -> dict[str, Any]:
    rows = await select("connections", {"user_id": f"eq.{user_id}", "select": "*"})
    return rows[0] if rows else {"user_id": user_id}


async def save_connection(user_id: str, **values: Any) -> None:
    await upsert("connections", {"user_id": user_id, **values, "updated_at": "now"}, "user_id")
