import { z } from "zod";

export const idSchema = z.string().min(1).max(64);

/** ISO date or datetime string → Date; null clears the field. */
export const nullableDate = z
  .union([z.iso.datetime({ offset: true }), z.iso.date(), z.null()])
  .transform(v => (v === null ? null : new Date(v)));

export const paginationSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.string().max(200).optional(),
});
