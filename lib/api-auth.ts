import type { NextRequest } from "next/server";

import { hasPaidAccess, PAYWALL_COOKIE_NAME } from "@/lib/paywall";

export function requestHasPaidAccess(request: NextRequest): boolean {
  const token = request.cookies.get(PAYWALL_COOKIE_NAME)?.value;
  return hasPaidAccess(token);
}
