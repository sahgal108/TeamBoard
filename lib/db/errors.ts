import { UniqueConstraintError } from "sequelize";

/** Unique constraint violation (e.g. duplicate team name inside a company). */
export const isUniqueViolation = (err: unknown): boolean => err instanceof UniqueConstraintError;
