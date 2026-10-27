import { z } from "zod";

export const summaryQuerySchema = z.object({
  period: z.enum(["day", "week"]).default("day"),
  /** `refresh=1` regenerates instead of serving the cached copy. Counts against the AI rate limit. */
  refresh: z
    .enum(["0", "1"])
    .default("0")
    .transform(v => v === "1"),
});
