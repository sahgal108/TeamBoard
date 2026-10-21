"use client";

/** Minimal fetch wrapper for client components: JSON in/out, error envelope → thrown message. */
export class ApiError extends Error {
  constructor(public readonly status: number, public readonly code: string, message: string, public readonly details?: unknown) {
    super(message);
  }
}

export async function api<T = unknown>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const res = await fetch(path, {
    method: init.method ?? "GET",
    headers: init.body !== undefined ? { "content-type": "application/json" } : undefined,
    body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
  });
  if (res.status === 204) return undefined as T;
  const json = await res.json().catch(() => null);
  if (!res.ok) {
    const err = json?.error ?? {};
    throw new ApiError(res.status, err.code ?? "INTERNAL", err.message ?? `Request failed (${res.status})`, err.details);
  }
  return json.data as T;
}

/** Field-level zod errors → one readable line. */
export function errorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    const fields = (err.details as { fieldErrors?: Record<string, string[]> } | undefined)?.fieldErrors;
    if (fields) {
      const first = Object.entries(fields).find(([, v]) => v?.length);
      if (first) return `${first[0]}: ${first[1][0]}`;
    }
    return err.message;
  }
  return err instanceof Error ? err.message : "Something went wrong";
}
