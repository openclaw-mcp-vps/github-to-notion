import { NextRequest, NextResponse } from "next/server";
import { upsertPaymentSession } from "@/lib/database";
import { parseLemonPayload, verifyLemonSignature } from "@/lib/payments";

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const signature = request.headers.get("x-signature");

  if (!verifyLemonSignature(rawBody, signature)) {
    return NextResponse.json({ message: "Invalid webhook signature." }, { status: 401 });
  }

  let payload: unknown;

  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ message: "Invalid JSON payload." }, { status: 400 });
  }

  const parsed = parseLemonPayload(payload as never);

  if (!parsed.sessionId) {
    return NextResponse.json({ message: "Missing checkout session id in webhook payload." }, { status: 202 });
  }

  await upsertPaymentSession({
    sessionId: parsed.sessionId,
    orderId: parsed.orderId,
    status: parsed.status,
    paidAt: parsed.status === "paid" ? new Date() : null
  });

  return NextResponse.json({ received: true, event: parsed.eventName, status: parsed.status });
}
