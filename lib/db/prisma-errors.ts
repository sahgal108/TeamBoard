/** Duck-typed checks for Prisma known request errors, so services don't import runtime classes. */
export function isPrismaError(err: unknown, code: string): boolean {
  return typeof err === "object" && err !== null && "code" in err && (err as { code?: unknown }).code === code;
}

/** Unique constraint violation (e.g. duplicate team name inside a company). */
export const isUniqueViolation = (err: unknown) => isPrismaError(err, "P2002");

/** Record required by the operation was not found (delete/update on a missing row). */
export const isNotFoundViolation = (err: unknown) => isPrismaError(err, "P2025");
