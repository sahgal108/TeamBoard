import { NextResponse } from "next/server";
import { ZodError } from "zod";

export type ErrorCode =
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "VALIDATION"
  | "INVALID_TRANSITION"
  | "RATE_LIMITED"
  | "AI_DISABLED"
  | "AI_UNAVAILABLE"
  | "INTERNAL";

export class AppError extends Error {
  constructor(
    public readonly code: ErrorCode,
    public readonly status: number,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = "Authentication required") {
    super("UNAUTHORIZED", 401, message);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "You do not have permission to do this") {
    super("FORBIDDEN", 403, message);
  }
}

/** Used for both "does not exist" and "exists in another tenant" — deliberately indistinguishable. */
export class NotFoundError extends AppError {
  constructor(entity = "Resource") {
    super("NOT_FOUND", 404, `${entity} not found`);
  }
}

export class ValidationError extends AppError {
  constructor(details: unknown, message = "Invalid request") {
    super("VALIDATION", 400, message, details);
  }
}

export class InvalidTransitionError extends AppError {
  constructor(from: string, to: string) {
    super("INVALID_TRANSITION", 400, `Cannot move from ${from} to ${to}`, { from, to });
  }
}

export class RateLimitedError extends AppError {
  constructor(message: string, retryAfterSeconds: number) {
    super("RATE_LIMITED", 429, message, { retryAfterSeconds });
  }
}

/** No AI provider is configured (GEMINI_API_KEY unset). The rest of the app is unaffected. */
export class AiDisabledError extends AppError {
  constructor() {
    super("AI_DISABLED", 503, "AI features are not configured on this server");
  }
}

/** Every configured model failed, timed out, or returned output that did not validate. */
export class AiUnavailableError extends AppError {
  constructor(message = "The AI service is unavailable right now. Try again in a minute.") {
    super("AI_UNAVAILABLE", 503, message);
  }
}

/** Single error envelope for every route handler: { error: { code, message, details? } }. */
export function toResponse(err: unknown): NextResponse {
  if (err instanceof AppError) {
    return NextResponse.json(
      { error: { code: err.code, message: err.message, ...(err.details !== undefined ? { details: err.details } : {}) } },
      { status: err.status },
    );
  }
  if (err instanceof ZodError) {
    return NextResponse.json(
      { error: { code: "VALIDATION", message: "Invalid request", details: err.flatten() } },
      { status: 400 },
    );
  }
  console.error("[unhandled]", err);
  return NextResponse.json({ error: { code: "INTERNAL", message: "Something went wrong" } }, { status: 500 });
}
