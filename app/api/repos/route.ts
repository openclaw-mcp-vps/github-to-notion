import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import {
  getRepoRuntime,
  listRepoConnections,
  saveRepoConnection,
  updateSyncState
} from "@/lib/db";
import { verifyGitHubAccess } from "@/lib/github";
import { requirePaidApiAccess } from "@/lib/http";
import { verifyNotionAccess } from "@/lib/notion";

export const runtime = "nodejs";

const setupSchema = z.object({
  repoFullName: z.string().regex(/^[^/\s]+\/[^/\s]+$/, "Use owner/repo format"),
  githubToken: z.string().min(20),
  notionToken: z.string().min(20),
  notionDatabaseId: z.string().min(20),
  githubWebhookSecret: z.string().min(6),
  notionWebhookSecret: z.string().min(6)
});

export async function GET(request: NextRequest) {
  const denied = requirePaidApiAccess(request);
  if (denied) {
    return denied;
  }

  try {
    const repos = await listRepoConnections();

    const runtime = await Promise.all(
      repos.map(async (repo) => {
        const status = await getRepoRuntime(repo.id);
        return { repo, status };
      })
    );

    const repoPayload = runtime.map(({ repo, status }) => ({
      id: repo.id,
      repoFullName: repo.repo_full_name,
      notionDatabaseId: repo.notion_database_id,
      updatedAt: repo.updated_at,
      status: status.state?.status ?? "idle",
      lastSyncedAt: status.state?.last_synced_at ?? null,
      latencyMs: status.state?.processing_ms ?? null,
      lastError: status.state?.last_error ?? null
    }));

    const eventPayload = runtime
      .flatMap(({ status }) => status.events)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 20)
      .map((event) => ({
        id: event.id,
        source: event.source,
        eventType: event.event_type,
        status: event.status,
        createdAt: event.created_at,
        detail: JSON.stringify(event.detail)
      }));

    return NextResponse.json({
      repos: repoPayload,
      events: eventPayload
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load repositories";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const denied = requirePaidApiAccess(request);
  if (denied) {
    return denied;
  }

  try {
    const input = setupSchema.parse(await request.json());

    await Promise.all([
      verifyGitHubAccess(input.githubToken, input.repoFullName),
      verifyNotionAccess(input.notionToken, input.notionDatabaseId)
    ]);

    const connection = await saveRepoConnection(input);
    await updateSyncState({
      repoId: connection.id,
      status: "idle",
      touched: false,
      lastError: null
    });

    return NextResponse.json({
      ok: true,
      repo: {
        id: connection.id,
        repoFullName: connection.repo_full_name,
        notionDatabaseId: connection.notion_database_id
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to save repository";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
