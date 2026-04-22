import { NextResponse } from "next/server";

import { handleGitHubWebhook } from "@/lib/sync-engine";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const rawBody = await request.text();

  try {
    await handleGitHubWebhook(rawBody, request.headers);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: `GitHub webhook rejected: ${(error as Error).message}` },
      { status: 401 }
    );
  }
}
