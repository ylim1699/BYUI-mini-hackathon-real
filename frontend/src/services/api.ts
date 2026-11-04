// Calls to our FastAPI backend. Components never call this directly; use hooks.
import type { z } from "zod";
import { mockApi } from "./mock/api";
import { accessToken, USE_MOCKS } from "./supabase";

export class ApiError extends Error {
  constructor(message: string, public code: string, public status: number) {
    super(message);
  }
}

export async function api<T>(path: string, schema: z.ZodType<T>, body?: unknown): Promise<T> {
  if (USE_MOCKS) return schema.parse(await mockApi(path, body));
  const token = await accessToken();
  let res: Response;
  try {
    res = await fetch(`/api${path}`, {
      method: body === undefined ? "GET" : "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError("Can't reach the server. Check your connection.", "network", 0);
  }
  const data: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    const detail = (data as { detail?: { message?: string; code?: string } | string } | null)?.detail;
    const message = typeof detail === "object" && detail?.message ? detail.message : "Something went wrong. Try again.";
    throw new ApiError(message, (typeof detail === "object" && detail?.code) || "error", res.status);
  }
  return schema.parse(data);
}

export const errorText = (e: unknown): string => (e instanceof Error ? e.message : "Something went wrong. Try again.");
