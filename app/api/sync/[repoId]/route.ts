import { NextRequest, NextResponse } from "next/server";
import { getRepoConfigBySession, getSyncOverview, repoKeyToFullName, upsertRepoConfig } from "@/lib/database";
import { getAppSession, refreshPaidStatus } from "@/lib/session";
import { runManualRepoSync } from "@/lib/sync";

interface SyncRequestBody {
  repoFullName?: string;
  githubToken?: string;
  notionToken?: string;
  notionDatabaseId?: string;
  syncNow?: boolean;
}

function maskToken(token: string) {
  if (token.length <= 8) {
    return "••••";
  }

  return `${token.slice(0, 4)}••••${token.slice(-4)}`;
}

export async function GET(
  _request: NextRequest,
  context: {
    params: Promise<{ repoId: string }>;
  }
) {
  const { repoId } = await context.params;
  const repoFullName = repoKeyToFullName(repoId);
  const session = await getAppSession();
  const paid = await refreshPaidStatus(session);

  if (!paid) {
    return NextResponse.json({ message: "Upgrade required." }, { status: 402 });
  }

  const config = await getRepoConfigBySession(session.sid as string);

  if (!config || config.repoFullName.toLowerCase() !== repoFullName.toLowerCase()) {
    return NextResponse.json({ message: "Repository is not configured for this account." }, { status: 404 });
  }

  const overview = await getSyncOverview(session.sid as string, repoFullName);

  return NextResponse.json({
    repoFullName,
    counts: overview.counts,
    status: overview.status,
    config: {
      githubToken: maskToken(config.githubToken),
      notionDatabaseId: config.notionDatabaseId
    }
  });
}

export async function POST(
  request: NextRequest,
  context: {
    params: Promise<{ repoId: string }>;
  }
) {
  const { repoId } = await context.params;
  const repoFromPath = repoKeyToFullName(repoId);
  const session = await getAppSession();
  const paid = await refreshPaidStatus(session);

  if (!paid) {
    return NextResponse.json({ message: "Upgrade required." }, { status: 402 });
  }

  const body = (await request.json()) as SyncRequestBody;
  const current = await getRepoConfigBySession(session.sid as string);

  const repoFullName = body.repoFullName || current?.repoFullName || repoFromPath;
  const githubToken = body.githubToken || current?.githubToken;
  const notionToken = body.notionToken || current?.notionToken;
  const notionDatabaseId = body.notionDatabaseId || current?.notionDatabaseId;

  if (!repoFullName || !githubToken || !notionToken || !notionDatabaseId) {
    return NextResponse.json(
      {
        message: "Provide repoFullName, githubToken, notionToken, and notionDatabaseId to configure sync."
      },
      { status: 400 }
    );
  }

  const config = await upsertRepoConfig({
    sessionId: session.sid as string,
    repoFullName,
    githubToken,
    notionToken,
    notionDatabaseId
  });

  let syncResult: { synced: number; tookMs: number } | null = null;

  if (body.syncNow) {
    syncResult = await runManualRepoSync(config);
  }

  const overview = await getSyncOverview(session.sid as string, repoFullName);

  return NextResponse.json({
    ok: true,
    repoFullName,
    syncResult,
    counts: overview.counts,
    status: overview.status
  });
}
