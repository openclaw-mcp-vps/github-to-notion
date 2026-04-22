import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";

import {
  addGitHubComment,
  createGitHubIssueFromNotion,
  listRecentRepoItems,
  updateGitHubItemFromNotion
} from "@/lib/github-client";
import {
  appendNotionComment,
  extractSyncFieldsFromNotionPage,
  findPageByGitHubRef,
  getNotionPage,
  upsertNotionPageFromGitHub
} from "@/lib/notion-client";
import { getSupabaseClient } from "@/lib/supabase";
import { addEvent, makeLinkKey, readState, updateState } from "@/lib/storage";
import type { AppState, PurchaseRecord, SyncEvent, SyncLink } from "@/lib/types";

function safeEqualString(left: string, right: string): boolean {
  const a = Buffer.from(left, "utf8");
  const b = Buffer.from(right, "utf8");

  if (a.length !== b.length) {
    return false;
  }

  return timingSafeEqual(a, b);
}

function signWithSha256(secret: string, payload: string): string {
  return createHmac("sha256", secret).update(payload).digest("hex");
}

function verifyGithubSignature(rawBody: string, signatureHeader: string | null, secret: string): boolean {
  if (!signatureHeader) {
    return false;
  }

  const expected = `sha256=${signWithSha256(secret, rawBody)}`;
  return safeEqualString(expected, signatureHeader);
}

function verifyNotionSignature(rawBody: string, signatureHeader: string | null, secret: string): boolean {
  if (!signatureHeader) {
    return false;
  }

  const expected = signWithSha256(secret, rawBody);
  return safeEqualString(expected, signatureHeader);
}

export function verifyStripeSignature(rawBody: string, signatureHeader: string | null, secret: string): boolean {
  if (!signatureHeader) {
    return false;
  }

  const parts = Object.fromEntries(
    signatureHeader
      .split(",")
      .map((part) => part.trim().split("="))
      .filter((pair) => pair.length === 2)
  );

  const timestamp = parts.t;
  const v1 = parts.v1;

  if (!timestamp || !v1) {
    return false;
  }

  const signedPayload = `${timestamp}.${rawBody}`;
  const expected = signWithSha256(secret, signedPayload);
  return safeEqualString(expected, v1);
}

function resolveConflict(link: SyncLink | undefined, source: "github" | "notion", incomingAt: string): boolean {
  if (!link) {
    return true;
  }

  const incoming = Date.parse(incomingAt);
  const against = source === "github" ? link.lastNotionUpdatedAt : link.lastGithubUpdatedAt;

  if (!against) {
    return true;
  }

  const againstTs = Date.parse(against);

  if (Number.isNaN(incoming) || Number.isNaN(againstTs)) {
    return true;
  }

  if (incoming >= againstTs) {
    return true;
  }

  return Math.abs(incoming - againstTs) <= 2000;
}

async function mirrorEventToSupabase(event: SyncEvent): Promise<void> {
  const supabase = getSupabaseClient();

  if (!supabase) {
    return;
  }

  try {
    await supabase.from("sync_events").insert({
      id: event.id,
      source: event.source,
      entity: event.entity,
      action: event.action,
      outcome: event.outcome,
      summary: event.summary,
      created_at: event.createdAt,
      latency_ms: event.latencyMs ?? null,
      metadata: event.metadata ?? {}
    });
  } catch {
    // Optional mirror only.
  }
}

async function recordEvent(event: Omit<SyncEvent, "id" | "createdAt">): Promise<void> {
  const created = await addEvent(event);
  await mirrorEventToSupabase(created);
}

async function storeProcessedWebhookId(id: string): Promise<void> {
  await updateState((state) => {
    state.processedWebhookIds.unshift(id);
    state.processedWebhookIds = state.processedWebhookIds.slice(0, 500);
  });
}

async function alreadyProcessedWebhookId(id: string): Promise<boolean> {
  const state = await readState();
  return state.processedWebhookIds.includes(id);
}

async function findLinkByNotionPageId(state: AppState, pageId: string): Promise<SyncLink | null> {
  const found = Object.values(state.links).find((link) => link.notionPageId === pageId);
  return found ?? null;
}

async function ensureLink(
  key: string,
  githubType: "issue" | "pull_request",
  githubNumber: number,
  notionPageId: string,
  source: "github" | "notion",
  updatedAt: string
): Promise<void> {
  await updateState((state) => {
    const existing = state.links[key];

    state.links[key] = {
      key,
      githubType,
      githubNumber,
      notionPageId,
      lastGithubUpdatedAt: source === "github" ? updatedAt : existing?.lastGithubUpdatedAt,
      lastNotionUpdatedAt: source === "notion" ? updatedAt : existing?.lastNotionUpdatedAt,
      lastConflictWinner: source,
      updatedAt: new Date().toISOString()
    };
  });
}

async function processGitHubIssueLikeEvent(
  eventName: "issues" | "pull_request",
  payload: any,
  state: AppState
): Promise<void> {
  const startedAt = Date.now();
  const item = eventName === "issues" ? payload.issue : payload.pull_request;

  if (!item || !payload.repository?.full_name) {
    return;
  }

  if (payload.repository.full_name !== state.config.githubRepo) {
    return;
  }

  const type = eventName === "pull_request" ? "pull_request" : "issue";
  const key = makeLinkKey(type, item.number);
  const existingLink = state.links[key];
  const incomingUpdatedAt = item.updated_at || new Date().toISOString();

  if (!resolveConflict(existingLink, "github", incomingUpdatedAt)) {
    await recordEvent({
      source: "github",
      entity: type,
      action: payload.action || "updated",
      outcome: "skipped",
      summary: `Skipped ${type} #${item.number}; Notion has newer change.`,
      metadata: {
        number: item.number
      }
    });
    return;
  }

  const notionPageId = await upsertNotionPageFromGitHub(
    state.config.notionToken,
    state.config.notionDatabaseId,
    {
      number: item.number,
      title: item.title,
      body: item.body || "",
      state: item.state,
      htmlUrl: item.html_url,
      updatedAt: incomingUpdatedAt,
      type,
      repo: payload.repository.full_name
    },
    existingLink?.notionPageId
  );

  await ensureLink(key, type, item.number, notionPageId, "github", incomingUpdatedAt);

  await recordEvent({
    source: "github",
    entity: type,
    action: payload.action || "updated",
    outcome: "processed",
    summary: `Synced ${type} #${item.number} to Notion in ${Date.now() - startedAt}ms.`,
    latencyMs: Date.now() - startedAt,
    metadata: {
      number: item.number,
      notionPageId
    }
  });
}

async function processGitHubCommentEvent(payload: any, state: AppState): Promise<void> {
  const startedAt = Date.now();
  const comment = payload.comment;
  const issue = payload.issue;

  if (!comment || !issue || !payload.repository?.full_name) {
    return;
  }

  if (payload.repository.full_name !== state.config.githubRepo) {
    return;
  }

  const commentId = String(comment.id);
  if (state.syncedCommentIds.includes(commentId)) {
    return;
  }

  const issueKey = makeLinkKey("issue", issue.number);
  const prKey = makeLinkKey("pull_request", issue.number);
  const link = state.links[prKey] || state.links[issueKey];

  if (!link) {
    await recordEvent({
      source: "github",
      entity: "comment",
      action: payload.action || "created",
      outcome: "skipped",
      summary: `Skipped comment ${commentId}: no linked Notion page yet.`,
      metadata: {
        commentId,
        issueNumber: issue.number
      }
    });
    return;
  }

  await appendNotionComment(
    state.config.notionToken,
    link.notionPageId,
    comment.body || "",
    comment.user?.login || "unknown",
    commentId
  );

  await updateState((next) => {
    next.syncedCommentIds.unshift(commentId);
    next.syncedCommentIds = next.syncedCommentIds.slice(0, 1000);
    const current = next.links[link.key];
    if (current) {
      current.lastGithubUpdatedAt = comment.updated_at || new Date().toISOString();
      current.lastConflictWinner = "github";
      current.updatedAt = new Date().toISOString();
    }
  });

  await recordEvent({
    source: "github",
    entity: "comment",
    action: payload.action || "created",
    outcome: "processed",
    summary: `Synced comment ${commentId} to Notion in ${Date.now() - startedAt}ms.`,
    latencyMs: Date.now() - startedAt,
    metadata: {
      commentId,
      notionPageId: link.notionPageId
    }
  });
}

export async function handleGitHubWebhook(rawBody: string, headers: Headers): Promise<void> {
  const state = await readState();
  const signature = headers.get("x-hub-signature-256");

  if (state.config.githubWebhookSecret) {
    const valid = verifyGithubSignature(rawBody, signature, state.config.githubWebhookSecret);

    if (!valid) {
      throw new Error("Invalid GitHub webhook signature.");
    }
  }

  const deliveryId = headers.get("x-github-delivery") || randomUUID();

  if (await alreadyProcessedWebhookId(deliveryId)) {
    return;
  }

  await storeProcessedWebhookId(deliveryId);

  if (!state.config.syncEnabled) {
    await recordEvent({
      source: "github",
      entity: "issue",
      action: "webhook",
      outcome: "skipped",
      summary: "Skipped GitHub webhook because sync is disabled.",
      metadata: {
        deliveryId
      }
    });
    return;
  }

  const eventName = headers.get("x-github-event") as
    | "issues"
    | "pull_request"
    | "issue_comment"
    | "pull_request_review_comment"
    | "ping"
    | null;

  const payload = JSON.parse(rawBody);

  if (eventName === "ping") {
    await recordEvent({
      source: "github",
      entity: "issue",
      action: "ping",
      outcome: "processed",
      summary: "Received GitHub webhook ping.",
      metadata: {
        deliveryId
      }
    });
    return;
  }

  if (eventName === "issues" || eventName === "pull_request") {
    await processGitHubIssueLikeEvent(eventName, payload, state);
    return;
  }

  if (eventName === "issue_comment" || eventName === "pull_request_review_comment") {
    await processGitHubCommentEvent(payload, state);
    return;
  }

  await recordEvent({
    source: "github",
    entity: "issue",
    action: eventName || "unknown",
    outcome: "skipped",
    summary: `Ignored unsupported GitHub event: ${eventName || "unknown"}.`,
    metadata: {
      deliveryId
    }
  });
}

function parseNotionWebhookEvents(payload: any): any[] {
  if (Array.isArray(payload.events)) {
    return payload.events;
  }

  if (payload.event) {
    return [payload.event];
  }

  return [payload];
}

async function processNotionPageUpdate(event: any, state: AppState): Promise<void> {
  const startedAt = Date.now();
  const pageId =
    event?.data?.id ||
    event?.data?.page_id ||
    event?.entity?.id ||
    event?.page?.id ||
    event?.id ||
    null;

  if (!pageId) {
    return;
  }

  const page = await getNotionPage(state.config.notionToken, pageId);
  const fields = extractSyncFieldsFromNotionPage(page);
  const link = await findLinkByNotionPageId(state, pageId);

  let targetNumber = fields.number;
  let targetType = fields.type;

  if (link) {
    targetNumber = link.githubNumber;
    targetType = link.githubType;
  }

  if (!targetNumber) {
    const created = await createGitHubIssueFromNotion(
      state.config.githubToken,
      state.config.githubRepo,
      fields.title,
      fields.body
    );

    const createdKey = makeLinkKey("issue", created.number);
    await ensureLink(createdKey, "issue", created.number, pageId, "notion", fields.updatedAt);

    await recordEvent({
      source: "notion",
      entity: "issue",
      action: "created",
      outcome: "processed",
      summary: `Created GitHub issue #${created.number} from Notion page in ${Date.now() - startedAt}ms.`,
      latencyMs: Date.now() - startedAt,
      metadata: {
        pageId,
        issueNumber: created.number
      }
    });
    return;
  }

  const key = makeLinkKey(targetType, targetNumber);
  const existing = state.links[key];

  if (!resolveConflict(existing, "notion", fields.updatedAt)) {
    await recordEvent({
      source: "notion",
      entity: targetType,
      action: "updated",
      outcome: "skipped",
      summary: `Skipped Notion update for ${targetType} #${targetNumber}; GitHub is newer.`,
      metadata: {
        pageId,
        number: targetNumber
      }
    });
    return;
  }

  await updateGitHubItemFromNotion(
    state.config.githubToken,
    state.config.githubRepo,
    targetNumber,
    fields.title,
    fields.body,
    fields.state
  );

  await ensureLink(key, targetType, targetNumber, pageId, "notion", fields.updatedAt);

  await recordEvent({
    source: "notion",
    entity: targetType,
    action: "updated",
    outcome: "processed",
    summary: `Synced Notion page to GitHub ${targetType} #${targetNumber} in ${Date.now() - startedAt}ms.`,
    latencyMs: Date.now() - startedAt,
    metadata: {
      pageId,
      number: targetNumber
    }
  });
}

async function processNotionComment(event: any, state: AppState): Promise<void> {
  const startedAt = Date.now();
  const pageId = event?.data?.parent?.page_id || event?.page_id || event?.data?.page_id || null;
  const commentId = String(event?.data?.id || event?.id || "");
  const commentText =
    event?.data?.rich_text?.map((node: any) => node.plain_text || "").join("") ||
    event?.comment?.rich_text?.map((node: any) => node.plain_text || "").join("") ||
    "";

  if (!pageId || !commentId || !commentText) {
    return;
  }

  if (state.syncedCommentIds.includes(commentId)) {
    return;
  }

  const link = await findLinkByNotionPageId(state, pageId);

  if (!link) {
    return;
  }

  await addGitHubComment(
    state.config.githubToken,
    state.config.githubRepo,
    link.githubNumber,
    commentText
  );

  await updateState((next) => {
    next.syncedCommentIds.unshift(commentId);
    next.syncedCommentIds = next.syncedCommentIds.slice(0, 1000);

    const current = next.links[link.key];
    if (current) {
      current.lastNotionUpdatedAt = new Date().toISOString();
      current.lastConflictWinner = "notion";
      current.updatedAt = new Date().toISOString();
    }
  });

  await recordEvent({
    source: "notion",
    entity: "comment",
    action: "created",
    outcome: "processed",
    summary: `Synced Notion comment ${commentId} to GitHub #${link.githubNumber} in ${Date.now() - startedAt}ms.`,
    latencyMs: Date.now() - startedAt,
    metadata: {
      pageId,
      issueNumber: link.githubNumber
    }
  });
}

export async function handleNotionWebhook(rawBody: string, headers: Headers): Promise<void> {
  const state = await readState();
  const signature = headers.get("x-notion-signature") || headers.get("notion-signature");

  if (state.config.notionWebhookSecret) {
    const valid = verifyNotionSignature(rawBody, signature, state.config.notionWebhookSecret);

    if (!valid) {
      throw new Error("Invalid Notion webhook signature.");
    }
  }

  if (!state.config.syncEnabled) {
    await recordEvent({
      source: "notion",
      entity: "issue",
      action: "webhook",
      outcome: "skipped",
      summary: "Skipped Notion webhook because sync is disabled."
    });
    return;
  }

  const payload = JSON.parse(rawBody);

  if (payload.challenge) {
    return;
  }

  const events = parseNotionWebhookEvents(payload);

  for (const event of events) {
    const type = String(event?.type || "").toLowerCase();

    if (type.includes("comment")) {
      await processNotionComment(event, state);
      continue;
    }

    if (type.includes("page")) {
      await processNotionPageUpdate(event, state);
      continue;
    }
  }
}

export async function runManualBackfill(limit = 20): Promise<{ processed: number; durationMs: number }> {
  const startedAt = Date.now();
  const state = await readState();

  if (!state.config.githubToken || !state.config.githubRepo || !state.config.notionToken || !state.config.notionDatabaseId) {
    throw new Error("Complete setup first: GitHub token/repo and Notion token/database are required.");
  }

  const items = await listRecentRepoItems(state.config.githubToken, state.config.githubRepo, limit);
  let processed = 0;

  for (const item of items) {
    const key = makeLinkKey(item.type, item.number);
    const existing = state.links[key];

    const notionPageId =
      existing?.notionPageId ||
      (await findPageByGitHubRef(
        state.config.notionToken,
        state.config.notionDatabaseId,
        `${item.type}:${item.number}`
      )) ||
      undefined;

    const pageId = await upsertNotionPageFromGitHub(
      state.config.notionToken,
      state.config.notionDatabaseId,
      {
        number: item.number,
        title: item.title,
        body: item.body,
        state: item.state,
        htmlUrl: item.htmlUrl,
        updatedAt: item.updatedAt,
        type: item.type,
        repo: state.config.githubRepo
      },
      notionPageId
    );

    await ensureLink(key, item.type, item.number, pageId, "github", item.updatedAt);
    processed += 1;
  }

  await recordEvent({
    source: "system",
    entity: "issue",
    action: "backfill",
    outcome: "processed",
    summary: `Backfilled ${processed} GitHub items into Notion in ${Date.now() - startedAt}ms.`,
    latencyMs: Date.now() - startedAt,
    metadata: {
      processed
    }
  });

  return {
    processed,
    durationMs: Date.now() - startedAt
  };
}

export async function recordSuccessfulStripePayment(record: PurchaseRecord): Promise<void> {
  await updateState((state) => {
    const exists = state.purchases.some((entry) => entry.stripeEventId === record.stripeEventId);

    if (!exists) {
      state.purchases.unshift(record);
      state.purchases = state.purchases.slice(0, 2000);
    }
  });

  await recordEvent({
    source: "stripe",
    entity: "issue",
    action: "checkout.session.completed",
    outcome: "processed",
    summary: `Recorded Stripe payment for ${record.email}.`,
    metadata: {
      email: record.email,
      stripeEventId: record.stripeEventId
    }
  });
}
