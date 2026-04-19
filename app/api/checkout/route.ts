import { NextRequest, NextResponse } from "next/server";
import { getCheckoutUrl } from "@/lib/payments";
import { getAppSession, refreshPaidStatus } from "@/lib/session";

export async function POST(request: NextRequest) {
  const session = await getAppSession();
  const paid = await refreshPaidStatus(session);

  if (paid) {
    return NextResponse.json({ message: "Plan already active." }, { status: 409 });
  }

  const checkoutUrl = getCheckoutUrl(session.sid as string, request.nextUrl.origin);

  return NextResponse.json({
    checkoutUrl,
    sessionId: session.sid
  });
}
