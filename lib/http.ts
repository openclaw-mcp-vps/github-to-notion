import { NextRequest, NextResponse } from "next/server";

import { PAYWALL_COOKIE_NAME, hasPaidAccess } from "@/lib/paywall";

export function requirePaidApiAccess(request: NextRequest) {
  const token = request.cookies.get(PAYWALL_COOKIE_NAME)?.value;

  if (!hasPaidAccess(token)) {
    return NextResponse.json({ error: "Paid access is required." }, { status: 402 });
  }

  return null;
}

export function jsonError(error: unknown, fallbackMessage = "Unexpected error", status = 500) {
  const message = error instanceof Error ? error.message : fallbackMessage;
  return NextResponse.json({ error: message }, { status });
}
