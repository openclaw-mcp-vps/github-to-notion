import { NextRequest, NextResponse } from "next/server";

import { requestHasPaidAccess } from "@/lib/api-auth";
import { readState, sanitizeConfig } from "@/lib/storage";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  if (!requestHasPaidAccess(request)) {
    return NextResponse.json({ error: "Payment required" }, { status: 401 });
  }

  const state = await readState();

  return NextResponse.json({
    config: sanitizeConfig(state.config),
    totals: {
      links: Object.keys(state.links).length,
      events: state.events.length,
      purchases: state.purchases.length
    },
    latestEvents: state.events.slice(0, 20)
  });
}
