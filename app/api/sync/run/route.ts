import { NextRequest, NextResponse } from "next/server";

import { requestHasPaidAccess } from "@/lib/api-auth";
import { runManualBackfill } from "@/lib/sync-engine";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  if (!requestHasPaidAccess(request)) {
    return NextResponse.json({ error: "Payment required" }, { status: 401 });
  }

  let limit = 20;

  try {
    const body = (await request.json()) as { limit?: number };
    if (typeof body.limit === "number") {
      limit = Math.max(1, Math.min(100, body.limit));
    }
  } catch {
    // Empty body falls back to default.
  }

  try {
    const result = await runManualBackfill(limit);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message || "Manual sync failed." },
      { status: 500 }
    );
  }
}
