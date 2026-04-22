import crypto from "node:crypto";

import { NextRequest, NextResponse } from "next/server";

import {
  findCommentMappingByNotionBlock,
  findMappingByNotionPage,
  getRepoConnectionByDatabase,
  logSyncEvent,
  upsertItemMapping,
  updateSyncState
} from "@/lib/db";
import {
  createCommentFromNotion,
  createIssueFromNotion,
  type WorkItemType,
  updateCommentFromNotion,
  updateWorkItemFromNotion
} from "@/lib/github";
import { readNotionPageForSync, updateNotionPageGitHubLink } from "@/lib/notion";

export const runtime = "nodejs";

function verifyNotionSignature(payload: string, provided: string | null, secret: string) {
  if (!provided) {
    return false;
  }

  const digest = crypto.createHmac("sha256", secret).update(payload).digest("hex");
  return provided === digest || provided === `sha256=${digest}` || provided === secret;
}

function extractDatabaseId(payload: any) {
  return (
    payload?.data?.database_id ??
    payload?.database_id ??
    payload?.data?.parent?.database_id ??
    payload?.entity?.parent?.id ??
    null
  );
}

function extractPageId(payload: any) {
  return payload?.data?.page_id ?? payload?.page_id ?? payload?.entity?.id ?? payload?.data?.id ?? null;
}

function extractEventType(payload: any) {
  return payload?.type ?? payload?.event_type ?? "unknown";
}

function statusToGitHubState(status: string | null) {
  if (!status) {
    return "open" as const;
  }

  return /closed|done|completed|merged/i.test(status) ? ("closed" as const) : ("open" as const);
}

function extractCommentBody(payload: any) {
  const body = payload?.data?.content ?? payload?.content ?? payload?.data?.comment_text ?? payload?.comment_text;
  if (typeof body === "string") {
    return body;
  }

  return "";
}

export async function POST(request: NextRequest) {
  const startedAt = Date.now();

  const payloadText = await request.text();
  let payload: any;

  try {
    payload = JSON.parse(payloadText);
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
  }

  const eventType = extractEventType(payload);
  const eventId = request.headers.get("x-notion-event-id") ?? payload?.id ?? null;
  const databaseId = extractDatabaseId(payload);

  if (!databaseId || typeof databaseId !== "string") {
    return NextResponse.json({ error: "Missing Notion database identifier" }, { status: 400 });
  }

  const connection = await getRepoConnectionByDatabase(databaseId);
  if (!connection) {
    return NextResponse.json({ ignored: true, reason: "No matching database connection" }, { status: 202 });
  }

  const signature = request.headers.get("x-notion-signature");
  if (!verifyNotionSignature(payloadText, signature, connection.notion_webhook_secret)) {
    return NextResponse.json({ error: "Invalid Notion signature" }, { status: 401 });
  }

  try {
    await updateSyncState({
      repoId: connection.id,
      status: "syncing",
      touched: false,
      notionEventId: eventId,
      lastError: null
    });

    if (eventType.includes("page")) {
      const pageId = extractPageId(payload);
      if (!pageId || typeof pageId !== "string") {
        throw new Error("Missing page ID for page event");
      }

      const page = await readNotionPageForSync({
        token: connection.notion_token,
        pageId,
        databaseId: connection.notion_database_id
      });

      const mapping = await findMappingByNotionPage(connection.id, pageId);
      const itemType: WorkItemType =
        mapping?.item_type === "pull_request" || page.itemType === "pull_request"
          ? "pull_request"
          : "issue";
      const number = page.number ?? mapping?.github_number ?? null;

      let githubItem;

      if (number) {
        githubItem = await updateWorkItemFromNotion({
          token: connection.github_token,
          owner: connection.repo_owner,
          repo: connection.repo_name,
          itemType,
          number,
          title: page.title,
          body: page.body,
          state: statusToGitHubState(page.status)
        });
      } else {
        if (itemType === "pull_request") {
          throw new Error("New pull requests must originate from GitHub. Add GitHub ID + Number for updates.");
        }

        githubItem = await createIssueFromNotion({
          token: connection.github_token,
          owner: connection.repo_owner,
          repo: connection.repo_name,
          title: page.title,
          body: page.body
        });
      }

      await updateNotionPageGitHubLink({
        token: connection.notion_token,
        pageId,
        githubItem
      });

      await upsertItemMapping({
        repoId: connection.id,
        itemType: githubItem.type,
        githubId: githubItem.githubId,
        githubNumber: githubItem.number,
        notionPageId: pageId,
        title: githubItem.title,
        status: githubItem.state
      });
    }

    if (eventType.includes("comment")) {
      const pageId = payload?.data?.page_id ?? payload?.page_id;
      const blockId = payload?.data?.block_id ?? payload?.block_id ?? payload?.data?.id ?? payload?.id;

      if (!pageId || typeof pageId !== "string") {
        throw new Error("Missing page ID for comment event");
      }

      const parentMapping = await findMappingByNotionPage(connection.id, pageId);
      if (!parentMapping || !parentMapping.github_number) {
        throw new Error("Missing parent mapping for Notion comment event");
      }

      const commentBody = extractCommentBody(payload);
      if (!commentBody) {
        throw new Error("Comment payload is empty");
      }

      const existingCommentMapping =
        typeof blockId === "string" ? await findCommentMappingByNotionBlock(connection.id, blockId) : null;

      let comment;

      if (existingCommentMapping) {
        comment = await updateCommentFromNotion({
          token: connection.github_token,
          owner: connection.repo_owner,
          repo: connection.repo_name,
          commentId: Number(existingCommentMapping.github_id),
          body: commentBody
        });

        await upsertItemMapping({
          repoId: connection.id,
          itemType: "comment",
          githubId: comment.githubId,
          githubNumber: parentMapping.github_number,
          notionPageId: pageId,
          notionBlockId: blockId,
          title: `Comment on #${parentMapping.github_number}`,
          status: "synced"
        });
      } else {
        comment = await createCommentFromNotion({
          token: connection.github_token,
          owner: connection.repo_owner,
          repo: connection.repo_name,
          issueNumber: parentMapping.github_number,
          body: commentBody
        });

        await upsertItemMapping({
          repoId: connection.id,
          itemType: "comment",
          githubId: comment.githubId,
          githubNumber: parentMapping.github_number,
          notionPageId: pageId,
          notionBlockId: typeof blockId === "string" ? blockId : null,
          title: `Comment on #${parentMapping.github_number}`,
          status: "synced"
        });
      }
    }

    const processingMs = Date.now() - startedAt;

    await updateSyncState({
      repoId: connection.id,
      status: "healthy",
      touched: true,
      processingMs,
      notionEventId: eventId,
      lastError: null
    });

    await logSyncEvent({
      repoId: connection.id,
      source: "notion",
      eventType,
      detail: { eventId },
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
      notionEventId: eventId,
      lastError: error instanceof Error ? error.message : "Notion webhook failed"
    });

    await logSyncEvent({
      repoId: connection.id,
      source: "notion",
      eventType,
      detail: { error: error instanceof Error ? error.message : "Notion webhook failed" },
      status: "error"
    });

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Notion webhook failed" },
      { status: 500 }
    );
  }
}
