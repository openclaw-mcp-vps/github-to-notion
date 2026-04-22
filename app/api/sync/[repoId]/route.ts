import { NextRequest, NextResponse } from "next/server";

import {
  findMappingByGitHubId,
  getRepoConnectionById,
  logSyncEvent,
  upsertItemMapping,
  updateSyncState
} from "@/lib/db";
import { fetchIssueComments, fetchRecentGitHubItems } from "@/lib/github";
import { requirePaidApiAccess } from "@/lib/http";
import { appendCommentToNotion, updateNotionCommentBlock, upsertNotionPageFromGitHub } from "@/lib/notion";

export const runtime = "nodejs";

export async function POST(request: NextRequest, context: { params: Promise<{ repoId: string }> }) {
  const denied = requirePaidApiAccess(request);
  if (denied) {
    return denied;
  }

  const { repoId } = await context.params;

  const startedAt = Date.now();

  try {
    const connection = await getRepoConnectionById(repoId);
    if (!connection) {
      return NextResponse.json({ error: "Repository connection not found." }, { status: 404 });
    }

    await updateSyncState({
      repoId,
      status: "syncing",
      lastError: null,
      touched: false
    });

    const items = await fetchRecentGitHubItems({
      token: connection.github_token,
      owner: connection.repo_owner,
      repo: connection.repo_name,
      perPage: 50
    });

    let syncedItems = 0;
    let syncedComments = 0;

    for (const item of items) {
      const mapping = await findMappingByGitHubId(repoId, item.type, item.githubId);

      const notionPageId = await upsertNotionPageFromGitHub({
        token: connection.notion_token,
        databaseId: connection.notion_database_id,
        repoFullName: connection.repo_full_name,
        githubItem: item,
        existingPageId: mapping?.notion_page_id ?? null
      });

      await upsertItemMapping({
        repoId,
        itemType: item.type,
        githubId: item.githubId,
        githubNumber: item.number,
        notionPageId,
        title: item.title,
        status: item.state
      });

      syncedItems += 1;

      const comments = await fetchIssueComments({
        token: connection.github_token,
        owner: connection.repo_owner,
        repo: connection.repo_name,
        issueNumber: item.number
      });

      for (const comment of comments) {
        const commentMapping = await findMappingByGitHubId(repoId, "comment", comment.githubId);

        if (commentMapping?.notion_block_id) {
          await updateNotionCommentBlock({
            token: connection.notion_token,
            blockId: commentMapping.notion_block_id,
            comment
          });

          await upsertItemMapping({
            repoId,
            itemType: "comment",
            githubId: comment.githubId,
            githubNumber: item.number,
            notionPageId,
            notionBlockId: commentMapping.notion_block_id,
            title: `Comment on #${item.number}`,
            status: "synced"
          });
        } else {
          const notionBlockId = await appendCommentToNotion({
            token: connection.notion_token,
            pageId: notionPageId,
            comment
          });

          await upsertItemMapping({
            repoId,
            itemType: "comment",
            githubId: comment.githubId,
            githubNumber: item.number,
            notionPageId,
            notionBlockId,
            title: `Comment on #${item.number}`,
            status: "synced"
          });
        }

        syncedComments += 1;
      }
    }

    const processingMs = Date.now() - startedAt;

    await updateSyncState({
      repoId,
      status: "healthy",
      touched: true,
      processingMs,
      lastError: null
    });

    await logSyncEvent({
      repoId,
      source: "manual",
      eventType: "backfill",
      detail: { syncedItems, syncedComments, processingMs },
      status: "ok"
    });

    return NextResponse.json({
      ok: true,
      syncedItems,
      syncedComments,
      processingMs
    });
  } catch (error) {
    const processingMs = Date.now() - startedAt;

    await updateSyncState({
      repoId,
      status: "error",
      touched: false,
      processingMs,
      lastError: error instanceof Error ? error.message : "Manual sync failed"
    });

    await logSyncEvent({
      repoId,
      source: "manual",
      eventType: "backfill",
      detail: {
        error: error instanceof Error ? error.message : "Manual sync failed"
      },
      status: "error"
    });

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Manual sync failed" },
      { status: 500 }
    );
  }
}
