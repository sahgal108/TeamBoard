import { NextResponse } from "next/server";
import { withAuth } from "@/lib/with-auth";
import { suggestSubtasks } from "@/services/breakdown.service";

/** POST, not GET: each call asks the model for a fresh suggestion and counts against the AI limits. Saves nothing. */
export const POST = withAuth<{ id: string }>(async (_req, ctx, { params }) => {
  const { id } = await params;
  return NextResponse.json({ data: await suggestSubtasks(ctx, id) });
});
