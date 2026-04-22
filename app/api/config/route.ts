import { NextRequest, NextResponse } from "next/server";

import { requestHasPaidAccess } from "@/lib/api-auth";
import { readState, sanitizeConfig, updateState } from "@/lib/storage";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  if (!requestHasPaidAccess(request)) {
    return NextResponse.json({ error: "Payment required" }, { status: 401 });
  }

  const state = await readState();

  return NextResponse.json({
    config: sanitizeConfig(state.config)
  });
}

export async function POST(request: NextRequest) {
  if (!requestHasPaidAccess(request)) {
    return NextResponse.json({ error: "Payment required" }, { status: 401 });
  }

  let body: Record<string, unknown>;

  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const updated = await updateState((state) => {
    const next = { ...state.config };

    if (typeof body.githubToken === "string" && body.githubToken.length > 0) {
      next.githubToken = body.githubToken.trim();
    }

    if (typeof body.githubRepo === "string") {
      next.githubRepo = body.githubRepo.trim();
    }

    if (typeof body.githubWebhookSecret === "string") {
      next.githubWebhookSecret = body.githubWebhookSecret.trim();
    }

    if (typeof body.notionToken === "string" && body.notionToken.length > 0) {
      next.notionToken = body.notionToken.trim();
    }

    if (typeof body.notionDatabaseId === "string") {
      next.notionDatabaseId = body.notionDatabaseId.trim();
    }

    if (typeof body.notionWebhookSecret === "string") {
      next.notionWebhookSecret = body.notionWebhookSecret.trim();
    }

    if (typeof body.syncEnabled === "boolean") {
      next.syncEnabled = body.syncEnabled;
    }

    state.config = next;
  });

  return NextResponse.json({
    ok: true,
    config: sanitizeConfig(updated.config)
  });
}
