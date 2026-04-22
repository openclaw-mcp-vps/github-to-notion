import { NextResponse } from "next/server";

import { handleNotionWebhook } from "@/lib/sync-engine";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const rawBody = await request.text();

  try {
    const payload = JSON.parse(rawBody) as { challenge?: string };

    if (payload.challenge) {
      return NextResponse.json({ challenge: payload.challenge });
    }
  } catch {
    // Continue and let sync engine handle parse errors.
  }

  try {
    await handleNotionWebhook(rawBody, request.headers);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: `Notion webhook rejected: ${(error as Error).message}` },
      { status: 401 }
    );
  }
}
