import { NextRequest, NextResponse } from "next/server";

import { requestHasPaidAccess } from "@/lib/api-auth";
import { listNotionDatabases } from "@/lib/notion-client";
import { readState } from "@/lib/storage";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  if (!requestHasPaidAccess(request)) {
    return NextResponse.json({ error: "Payment required" }, { status: 401 });
  }

  const state = await readState();

  if (!state.config.notionToken) {
    return NextResponse.json({ error: "Connect Notion first." }, { status: 400 });
  }

  try {
    const databases = await listNotionDatabases(state.config.notionToken);
    return NextResponse.json({ databases });
  } catch (error) {
    return NextResponse.json(
      { error: `Failed to fetch Notion databases: ${(error as Error).message}` },
      { status: 500 }
    );
  }
}
