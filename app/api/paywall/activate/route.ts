import { NextRequest, NextResponse } from "next/server";

import { findPaidSession } from "@/lib/db";
import { createPaywallToken, paywallCookieConfig } from "@/lib/paywall";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const sessionId = request.nextUrl.searchParams.get("session_id");

  if (!sessionId) {
    return NextResponse.json({ error: "Missing session_id" }, { status: 400 });
  }

  if (process.env.NODE_ENV !== "production" && sessionId === "dev") {
    const response = NextResponse.json({ ok: true, devMode: true });
    response.cookies.set(paywallCookieConfig(createPaywallToken({ sessionId: "dev" })));
    return response;
  }

  try {
    const payment = await findPaidSession(sessionId);

    if (!payment) {
      return NextResponse.json(
        {
          error:
            "Session is not marked paid yet. Make sure Stripe webhook events are reaching /api/webhooks/stripe."
        },
        { status: 403 }
      );
    }

    const response = NextResponse.json({ ok: true });
    response.cookies.set(
      paywallCookieConfig(
        createPaywallToken({
          sessionId,
          email: payment.customer_email
        })
      )
    );

    return response;
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to activate paywall" },
      { status: 500 }
    );
  }
}
