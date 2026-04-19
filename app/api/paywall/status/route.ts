import { NextResponse } from "next/server";
import { getRepoConfigBySession } from "@/lib/database";
import { getAppSession, refreshPaidStatus } from "@/lib/session";

export async function GET() {
  const session = await getAppSession();
  const paid = await refreshPaidStatus(session);
  const config = await getRepoConfigBySession(session.sid as string);

  return NextResponse.json({
    paid,
    sessionId: session.sid,
    configured: Boolean(config),
    repoFullName: config?.repoFullName ?? null
  });
}
