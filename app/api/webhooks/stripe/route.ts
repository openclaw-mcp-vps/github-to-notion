import { NextRequest, NextResponse } from "next/server";

import { saveStripePayment } from "@/lib/db";
import { verifyStripeSignature } from "@/lib/security";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const payloadText = await request.text();
  const signature = request.headers.get("stripe-signature");

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (webhookSecret && !verifyStripeSignature(payloadText, signature, webhookSecret)) {
    return NextResponse.json({ error: "Invalid Stripe signature" }, { status: 401 });
  }

  let event: any;
  try {
    event = JSON.parse(payloadText);
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
  }

  const type = event?.type as string | undefined;
  const session = event?.data?.object;

  if (session?.id) {
    if (type === "checkout.session.completed" || type === "checkout.session.async_payment_succeeded") {
      await saveStripePayment({
        sessionId: session.id,
        customerEmail: session.customer_details?.email ?? null,
        status: session.payment_status === "paid" ? "paid" : "pending",
        amountTotal: typeof session.amount_total === "number" ? session.amount_total : null,
        currency: session.currency ?? null
      });
    }

    if (type === "checkout.session.expired") {
      await saveStripePayment({
        sessionId: session.id,
        customerEmail: session.customer_details?.email ?? null,
        status: "expired",
        amountTotal: typeof session.amount_total === "number" ? session.amount_total : null,
        currency: session.currency ?? null
      });
    }
  }

  return NextResponse.json({ received: true });
}
