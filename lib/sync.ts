import {
  getRepoConfigByRepo,
  getSyncMappingByGitHubItem,
  getSyncMappingByNotionPage,
  saveSyncEvent,
  upsertSyncMapping,
  upsertSyncStatus,
  type RepoSyncConfig
} from "@/lib/database";
import {
  createGitHubComment,
  fetchRepositorySnapshot,
  updateGitHubIssueState,
  type GitHubCommentPayload,
  type GitHubIssuePayload
} from "@/lib/github";
import {
  appendGitHubCommentToNotion,
  extractStateAndCommentFromNotionPage,
  getNotionClient,
  upsertGitHubItemInNotion
} from "@/lib/notion";

interface GitHubWebhookPayload {
  action?: string;
  repository?: {
    full_name?: string;
  };
  issue?: GitHubIssuePayload;
  pull_request?: GitHubIssuePayload;
  comment?: GitHubCommentPayload;
}

function toSafeError(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return "Unknown sync error";
}

async function syncGitHubIssueLike(params: {
  config: RepoSyncConfig;
  itemType: "issue" | "pull_request";
  item: GitHubIssuePayload;
}) {
  const existing = await getSyncMappingByGitHubItem({
    repoFullName: params.config.repoFullName,
    itemType: params.itemType,
    githubItemId: String(params.item.id)
  });

  const notionPageId = await upsertGitHubItemInNotion({
    notionToken: params.config.notionToken,
    notionDatabaseId: params.config.notionDatabaseId,
    notionPageId: existing?.notionPageId,
    itemType: params.itemType,
    item: params.item
  });

  await upsertSyncMapping({
    sessionId: params.config.sessionId,
    repoFullName: params.config.repoFullName,
    itemType: params.itemType,
    githubItemId: String(params.item.id),
    githubNumber: params.item.number,
    notionPageId,
    itemStatus: params.item.state
  });

  return notionPageId;
}

async function syncGitHubComment(params: {
  config: RepoSyncConfig;
  issue: GitHubIssuePayload;
  comment: GitHubCommentPayload;
}) {
  let parent = await getSyncMappingByGitHubItem({
    repoFullName: params.config.repoFullName,
    itemType: params.issue.pull_request ? "pull_request" : "issue",
    githubItemId: String(params.issue.id)
  });

  if (!parent) {
    const notionPageId = await syncGitHubIssueLike({
      config: params.config,
      itemType: params.issue.pull_request ? "pull_request" : "issue",
      item: params.issue
    });

    parent = {
      id: 0,
      sessionId: params.config.sessionId,
      repoFullName: params.config.repoFullName,
      itemType: params.issue.pull_request ? "pull_request" : "issue",
      githubItemId: String(params.issue.id),
      githubNumber: params.issue.number,
      notionPageId,
      notionCommentId: null,
      itemStatus: params.issue.state,
      updatedAt: new Date().toISOString()
    };
  }

  const existingComment = await getSyncMappingByGitHubItem({
    repoFullName: params.config.repoFullName,
    itemType: "comment",
    githubItemId: String(params.comment.id)
  });

  const notionCommentId = await appendGitHubCommentToNotion({
    notionToken: params.config.notionToken,
    notionPageId: parent.notionPageId,
    comment: params.comment
  });

  await upsertSyncMapping({
    sessionId: params.config.sessionId,
    repoFullName: params.config.repoFullName,
    itemType: "comment",
    githubItemId: String(params.comment.id),
    githubNumber: params.issue.number,
    notionPageId: parent.notionPageId,
    notionCommentId: notionCommentId || existingComment?.notionCommentId || null,
    itemStatus: "synced"
  });
}

export async function handleGitHubWebhook(eventType: string, payload: GitHubWebhookPayload) {
  const start = Date.now();
  const repoFullName = payload.repository?.full_name;

  if (!repoFullName) {
    return { handled: false, reason: "Missing repository in GitHub webhook payload." };
  }

  const config = await getRepoConfigByRepo(repoFullName);

  if (!config) {
    return { handled: false, reason: "No sync configuration for repository." };
  }

  await saveSyncEvent({
    sessionId: config.sessionId,
    source: "github",
    eventType,
    payload
  });

  try {
    if (eventType === "issues" && payload.issue) {
      await syncGitHubIssueLike({
        config,
        itemType: "issue",
        item: payload.issue
      });
    }

    if (eventType === "pull_request" && payload.pull_request) {
      await syncGitHubIssueLike({
        config,
        itemType: "pull_request",
        item: payload.pull_request
      });
    }

    if (eventType === "issue_comment" && payload.issue && payload.comment) {
      await syncGitHubComment({
        config,
        issue: payload.issue,
        comment: payload.comment
      });
    }

    const latencyMs = Date.now() - start;

    await upsertSyncStatus({
      sessionId: config.sessionId,
      repoFullName: config.repoFullName,
      source: "github",
      latencyMs,
      error: null
    });

    return { handled: true, latencyMs };
  } catch (error) {
    const message = toSafeError(error);

    await upsertSyncStatus({
      sessionId: config.sessionId,
      repoFullName: config.repoFullName,
      source: "github",
      error: message
    });

    throw error;
  }
}

interface NotionWebhookPayload {
  type?: string;
  entity?: {
    id?: string;
  };
  data?: {
    id?: string;
    parent?: {
      page_id?: string;
    };
    rich_text?: Array<{ plain_text?: string }>;
  };
}

export async function handleNotionWebhook(payload: NotionWebhookPayload) {
  const start = Date.now();
  const notionPageId = payload.entity?.id || payload.data?.id || payload.data?.parent?.page_id;

  if (!notionPageId) {
    return { handled: false, reason: "Missing Notion page id in webhook payload." };
  }

  const mapping = await getSyncMappingByNotionPage(notionPageId);

  if (!mapping) {
    return { handled: false, reason: "Notion page is not linked to a GitHub item." };
  }

  const config = await getRepoConfigByRepo(mapping.repoFullName);

  if (!config) {
    return { handled: false, reason: "No sync configuration for Notion page mapping." };
  }

  await saveSyncEvent({
    sessionId: config.sessionId,
    source: "notion",
    eventType: payload.type || "unknown",
    payload
  });

  try {
    const notion = getNotionClient(config.notionToken);
    const page = (await notion.pages.retrieve({ page_id: notionPageId })) as {
      properties?: Record<string, unknown>;
    };

    const { state, comment } = extractStateAndCommentFromNotionPage(page);

    if (state && mapping.githubNumber) {
      await updateGitHubIssueState({
        githubToken: config.githubToken,
        repoFullName: config.repoFullName,
        issueNumber: mapping.githubNumber,
        state
      });

      await upsertSyncMapping({
        sessionId: config.sessionId,
        repoFullName: config.repoFullName,
        itemType: mapping.itemType,
        githubItemId: mapping.githubItemId,
        githubNumber: mapping.githubNumber,
        notionPageId: mapping.notionPageId,
        notionCommentId: mapping.notionCommentId,
        itemStatus: state
      });
    }

    const commentText =
      comment ||
      payload.data?.rich_text
        ?.map((entry) => entry.plain_text || "")
        .join("")
        .trim() ||
      null;

    if (commentText && mapping.githubNumber && !commentText.toLowerCase().includes("[from github]")) {
      await createGitHubComment({
        githubToken: config.githubToken,
        repoFullName: config.repoFullName,
        issueNumber: mapping.githubNumber,
        body: `[from Notion] ${commentText}`
      });
    }

    const latencyMs = Date.now() - start;

    await upsertSyncStatus({
      sessionId: config.sessionId,
      repoFullName: config.repoFullName,
      source: "notion",
      latencyMs,
      error: null
    });

    return {
      handled: true,
      latencyMs
    };
  } catch (error) {
    const message = toSafeError(error);

    await upsertSyncStatus({
      sessionId: config.sessionId,
      repoFullName: config.repoFullName,
      source: "notion",
      error: message
    });

    throw error;
  }
}

export async function runManualRepoSync(config: RepoSyncConfig) {
  const start = Date.now();
  let synced = 0;

  const snapshot = await fetchRepositorySnapshot(config.repoFullName, config.githubToken, 100);

  for (const entry of snapshot) {
    await syncGitHubIssueLike({
      config,
      itemType: entry.itemType,
      item: entry.item
    });

    synced += 1;
  }

  await upsertSyncStatus({
    sessionId: config.sessionId,
    repoFullName: config.repoFullName,
    source: "github",
    latencyMs: Date.now() - start,
    error: null
  });

  return {
    synced,
    tookMs: Date.now() - start
  };
}
