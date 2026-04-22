import { NextRequest, NextResponse } from "next/server";

import {
  deleteCommentMapping,
  findMappingByGitHubId,
  findMappingByNumber,
  getRepoConnectionByFullName,
  logSyncEvent,
  upsertItemMapping,
  updateSyncState
} from "@/lib/db";
import type { GitHubWorkItem } from "@/lib/github";
import { verifyGitHubSignature } from "@/lib/security";
import {
  appendCommentToNotion,
  archiveNotionBlock,
  updateNotionCommentBlock,
  upsertNotionPageFromGitHub
} from "@/lib/notion";

export const runtime = "nodejs";

function issuePayloadToWorkItem(payload: any): GitHubWorkItem {
  return {
    type: payload.pull_request ? "pull_request" : "issue",
    githubId: String(payload.id),
    number: payload.number,
    title: payload.title ?? "",
    body: payload.body ?? "",
    state: payload.state,
    url: payload.html_url,
    author: payload.user?.login ?? "unknown",
    updatedAt: payload.updated_at ?? new Date().toISOString()
  };
}

function pullRequestPayloadToWorkItem(payload: any): GitHubWorkItem {
  return {
    type: "pull_request",
    githubId: String(payload.id),
    number: payload.number,
    title: payload.title ?? "",
    body: payload.body ?? "",
    state: payload.merged ? "merged" : payload.state,
    url: payload.html_url,
    author: payload.user?.login ?? "unknown",
    updatedAt: payload.updated_at ?? new Date().toISOString()
  };
}

export async function POST(request: NextRequest) {
  const startedAt = Date.now();

  const payloadText = await request.text();
  const event = request.headers.get("x-github-event") ?? "unknown";
  const deliveryId = request.headers.get("x-github-delivery");

  let payload: any;
  try {
    payload = JSON.parse(payloadText);
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
  }

  const repoFullName = payload?.repository?.full_name as string | undefined;
  if (!repoFullName) {
    return NextResponse.json({ error: "Missing repository.full_name" }, { status: 400 });
  }

  const connection = await getRepoConnectionByFullName(repoFullName);
  if (!connection) {
    return NextResponse.json({ ignored: true, reason: "No matching repo connection" }, { status: 202 });
  }

  const signature = request.headers.get("x-hub-signature-256");
  if (!verifyGitHubSignature(payloadText, signature, connection.github_webhook_secret)) {
    return NextResponse.json({ error: "Invalid GitHub signature" }, { status: 401 });
  }

  try {
    await updateSyncState({
      repoId: connection.id,
      status: "syncing",
      touched: false,
      githubDeliveryId: deliveryId,
      lastError: null
    });

    if (event === "issues" || event === "pull_request") {
      const action = payload.action as string;
      const allowedActions = new Set(["opened", "edited", "reopened", "closed", "synchronize"]);

      if (allowedActions.has(action)) {
        const githubItem =
          event === "issues"
            ? issuePayloadToWorkItem(payload.issue)
            : pullRequestPayloadToWorkItem(payload.pull_request);

        const mapping = await findMappingByGitHubId(connection.id, githubItem.type, githubItem.githubId);

        const notionPageId = await upsertNotionPageFromGitHub({
          token: connection.notion_token,
          databaseId: connection.notion_database_id,
          repoFullName: connection.repo_full_name,
          githubItem,
          existingPageId: mapping?.notion_page_id ?? null
        });

        await upsertItemMapping({
          repoId: connection.id,
          itemType: githubItem.type,
          githubId: githubItem.githubId,
          githubNumber: githubItem.number,
          notionPageId,
          title: githubItem.title,
          status: githubItem.state
        });
      }
    }

    if (event === "issue_comment") {
      const action = payload.action as string;
      const comment = payload.comment;
      const issue = payload.issue;
      const itemType = issue.pull_request ? "pull_request" : "issue";

      let parentMapping = await findMappingByNumber(connection.id, itemType, issue.number);

      if (!parentMapping) {
        const githubItem = issuePayloadToWorkItem(issue);
        const notionPageId = await upsertNotionPageFromGitHub({
          token: connection.notion_token,
          databaseId: connection.notion_database_id,
          repoFullName: connection.repo_full_name,
          githubItem
        });

        parentMapping = await upsertItemMapping({
          repoId: connection.id,
          itemType,
          githubId: githubItem.githubId,
          githubNumber: githubItem.number,
          notionPageId,
          title: githubItem.title,
          status: githubItem.state
        });
      }

      const commentItem = {
        githubId: String(comment.id),
        issueNumber: issue.number,
        body: comment.body ?? "",
        author: comment.user?.login ?? "unknown",
        createdAt: comment.created_at,
        updatedAt: comment.updated_at,
        url: comment.html_url
      };

      const commentMapping = await findMappingByGitHubId(connection.id, "comment", commentItem.githubId);

      if (action === "deleted") {
        if (commentMapping?.notion_block_id) {
          await archiveNotionBlock({
            token: connection.notion_token,
            blockId: commentMapping.notion_block_id
          });
        }

        await deleteCommentMapping(connection.id, commentItem.githubId);
      }

      if (action === "created" || action === "edited") {
        if (commentMapping?.notion_block_id) {
          await updateNotionCommentBlock({
            token: connection.notion_token,
            blockId: commentMapping.notion_block_id,
            comment: commentItem
          });

          await upsertItemMapping({
            repoId: connection.id,
            itemType: "comment",
            githubId: commentItem.githubId,
            githubNumber: issue.number,
            notionPageId: parentMapping.notion_page_id,
            notionBlockId: commentMapping.notion_block_id,
            title: `Comment on #${issue.number}`,
            status: "synced"
          });
        } else {
          const notionBlockId = await appendCommentToNotion({
            token: connection.notion_token,
            pageId: parentMapping.notion_page_id,
            comment: commentItem
          });

          await upsertItemMapping({
            repoId: connection.id,
            itemType: "comment",
            githubId: commentItem.githubId,
            githubNumber: issue.number,
            notionPageId: parentMapping.notion_page_id,
            notionBlockId,
            title: `Comment on #${issue.number}`,
            status: "synced"
          });
        }
      }
    }

    const processingMs = Date.now() - startedAt;

    await updateSyncState({
      repoId: connection.id,
      status: "healthy",
      touched: true,
      processingMs,
      githubDeliveryId: deliveryId,
      lastError: null
    });

    await logSyncEvent({
      repoId: connection.id,
      source: "github",
      eventType: event,
      detail: { deliveryId, action: payload.action ?? null },
      status: "ok"
    });

    return NextResponse.json({ ok: true, processingMs });
  } catch (error) {
    const processingMs = Date.now() - startedAt;

    await updateSyncState({
      repoId: connection.id,
      status: "error",
      touched: false,
      processingMs,
      githubDeliveryId: deliveryId,
      lastError: error instanceof Error ? error.message : "GitHub webhook failed"
    });

    await logSyncEvent({
      repoId: connection.id,
      source: "github",
      eventType: event,
      detail: { error: error instanceof Error ? error.message : "GitHub webhook failed" },
      status: "error"
    });

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "GitHub webhook failed" },
      { status: 500 }
    );
  }
}
