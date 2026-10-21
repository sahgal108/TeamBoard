import { NextResponse } from "next/server";
import { withAuth } from "@/lib/with-auth";
import { getDashboard } from "@/services/dashboard.service";

export const GET = withAuth(async (_req, ctx) => {
  const { cacheHit, ...dashboard } = await getDashboard(ctx);
  return NextResponse.json({ data: dashboard }, { headers: { "x-cache": cacheHit ? "HIT" : "MISS" } });
});
