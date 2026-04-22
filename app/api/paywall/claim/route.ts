import { NextRequest, NextResponse } from "next/server";

import {
  accessCookieOptions,
  hasPurchaseEmail,
  makeAccessToken,
  PAYWALL_COOKIE_NAME
} from "@/lib/paywall";
import { boolEnv } from "@/lib/env";
import { readState } from "@/lib/storage";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  let body: { email?: string };

  try {
    body = (await request.json()) as { email?: string };
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const email = body.email?.toLowerCase().trim();

  if (!email) {
    return NextResponse.json({ error: "Email is required." }, { status: 400 });
  }

  const state = await readState();
  const canBypass = boolEnv("PAYWALL_DEV_BYPASS");

  if (!canBypass && !hasPurchaseEmail(state.purchases, email)) {
    return NextResponse.json(
      {
        error:
          "No Stripe payment found for this email yet. Complete checkout first or wait for webhook delivery."
      },
      { status: 404 }
    );
  }

  const token = makeAccessToken(email);
  const response = NextResponse.json({ ok: true });

  response.cookies.set({
    name: PAYWALL_COOKIE_NAME,
    value: token,
    ...accessCookieOptions()
  });

  return response;
}
