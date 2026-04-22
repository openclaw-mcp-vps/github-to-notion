import { NextResponse } from "next/server";

import { optionalEnv } from "@/lib/env";
import { recordSuccessfulStripePayment, verifyStripeSignature } from "@/lib/sync-engine";

export const runtime = "nodejs";

type StripeEventPayload = {
  id?: string;
  type?: string;
  data?: {
    object?: {
      customer_email?: string;
      customer_details?: {
        email?: string;
      };
      amount_total?: number;
      currency?: string;
      payment_status?: string;
    };
  };
};

export async function POST(request: Request) {
  const webhookSecret = optionalEnv("STRIPE_WEBHOOK_SECRET");

  if (!webhookSecret) {
    return NextResponse.json(
      { error: "Set STRIPE_WEBHOOK_SECRET before enabling Stripe webhooks." },
      { status: 500 }
    );
  }

  const rawBody = await request.text();
  const signature = request.headers.get("stripe-signature");
  const isValid = verifyStripeSignature(rawBody, signature, webhookSecret);

  if (!isValid) {
    return NextResponse.json({ error: "Invalid Stripe signature." }, { status: 401 });
  }

  const event = JSON.parse(rawBody) as StripeEventPayload;

  if (event.type === "checkout.session.completed") {
    const email = event.data?.object?.customer_details?.email || event.data?.object?.customer_email;

    if (email) {
      await recordSuccessfulStripePayment({
        email,
        paidAt: new Date().toISOString(),
        source: "stripe",
        stripeEventId: event.id || "unknown",
        amountTotal: event.data?.object?.amount_total,
        currency: event.data?.object?.currency
      });
    }
  }

  return NextResponse.json({ received: true });
}
