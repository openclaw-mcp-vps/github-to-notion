import { NextRequest, NextResponse } from "next/server";
import { verifyGitHubSignature } from "@/lib/github";
import { handleGitHubWebhook } from "@/lib/sync";

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const signature = request.headers.get("x-hub-signature-256");

  if (!verifyGitHubSignature(rawBody, signature)) {
    return NextResponse.json({ message: "Invalid GitHub webhook signature." }, { status: 401 });
  }

  const eventType = request.headers.get("x-github-event") || "unknown";

  if (eventType === "ping") {
    return NextResponse.json({ received: true, event: "ping" });
  }

  let payload: unknown;

  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ message: "Invalid JSON payload." }, { status: 400 });
  }

  try {
    const result = await handleGitHubWebhook(eventType, payload as never);
    return NextResponse.json({ received: true, ...result });
  } catch (error) {
    return NextResponse.json(
      {
        message: error instanceof Error ? error.message : "GitHub webhook processing failed."
      },
      { status: 500 }
    );
  }
}
