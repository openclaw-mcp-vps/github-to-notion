import { NextRequest, NextResponse } from "next/server";
import { handleNotionWebhook } from "@/lib/sync";
import { verifyNotionSignature } from "@/lib/notion";

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const signature = request.headers.get("x-notion-signature");
  const timestamp = request.headers.get("x-notion-request-timestamp");

  if (!verifyNotionSignature({ rawBody, signature, timestamp })) {
    return NextResponse.json({ message: "Invalid Notion webhook signature." }, { status: 401 });
  }

  let payload: unknown;

  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ message: "Invalid JSON payload." }, { status: 400 });
  }

  try {
    const result = await handleNotionWebhook(payload as never);
    return NextResponse.json({ received: true, ...result });
  } catch (error) {
    return NextResponse.json(
      {
        message: error instanceof Error ? error.message : "Notion webhook processing failed."
      },
      { status: 500 }
    );
  }
}
