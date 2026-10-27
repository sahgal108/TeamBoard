import { NextResponse } from "next/server";
import { readQuery, withAuth } from "@/lib/with-auth";
import { getCompanySummary } from "@/services/summary.service";
import { summaryQuerySchema } from "@/validations/summary.schema";

/** Company-wide summary (leadership only). Project and team summaries live under their resources. */
export const GET = withAuth(async (req, ctx) => {
  const { period, refresh } = summaryQuerySchema.parse(readQuery(req));
  const { summary, cacheHit } = await getCompanySummary(ctx, period, refresh);
  return NextResponse.json({ data: summary }, { headers: { "x-cache": cacheHit ? "HIT" : "MISS" } });
});
