import { z } from "zod";
import { idSchema, paginationSchema } from "./common";

export const activityQuerySchema = paginationSchema.extend({
  projectId: idSchema.optional(),
  teamId: idSchema.optional(),
});
export type ActivityQuery = z.infer<typeof activityQuerySchema>;

export const searchQuerySchema = z.object({
  q: z.string().trim().min(1).max(100),
});
