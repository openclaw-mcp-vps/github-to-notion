import { NextRequest, NextResponse } from "next/server";

import { requestHasPaidAccess } from "@/lib/api-auth";
import { listGitHubRepos } from "@/lib/github-client";
import { readState } from "@/lib/storage";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  if (!requestHasPaidAccess(request)) {
    return NextResponse.json({ error: "Payment required" }, { status: 401 });
  }

  const state = await readState();

  if (!state.config.githubToken) {
    return NextResponse.json({ error: "Connect GitHub first." }, { status: 400 });
  }

  try {
    const repos = await listGitHubRepos(state.config.githubToken);
    return NextResponse.json({ repos });
  } catch (error) {
    return NextResponse.json(
      { error: `Failed to fetch repositories: ${(error as Error).message}` },
      { status: 500 }
    );
  }
}
