import { randomUUID } from "node:crypto";
import { Pool, type QueryResultRow } from "pg";

export type RepoConnection = {
  id: string;
  repo_owner: string;
  repo_name: string;
  repo_full_name: string;
  github_token: string;
  notion_token: string;
  notion_database_id: string;
  github_webhook_secret: string;
  notion_webhook_secret: string;
  created_at: string;
  updated_at: string;
};

type SyncState = {
  repo_id: string;
  status: string;
  last_synced_at: string | null;
  last_error: string | null;
  processing_ms: number | null;
  github_delivery_id: string | null;
  notion_event_id: string | null;
  updated_at: string;
};

type SyncEvent = {
  id: number;
  repo_id: string;
  source: string;
  event_type: string;
  detail: unknown;
  status: string;
  created_at: string;
};

let pool: Pool | null = null;
let schemaReady = false;

function getPool() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is missing. Set DATABASE_URL before using API routes.");
  }

  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 8,
      ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false
    });
  }

  return pool;
}

async function query<T extends QueryResultRow>(sql: string, params: unknown[] = []) {
  const db = getPool();
  return db.query<T>(sql, params);
}

export async function ensureSchema() {
  if (schemaReady) {
    return;
  }

  await query(`
    CREATE TABLE IF NOT EXISTS repo_connections (
      id TEXT PRIMARY KEY,
      repo_owner TEXT NOT NULL,
      repo_name TEXT NOT NULL,
      repo_full_name TEXT NOT NULL UNIQUE,
      github_token TEXT NOT NULL,
      notion_token TEXT NOT NULL,
      notion_database_id TEXT NOT NULL,
      github_webhook_secret TEXT NOT NULL,
      notion_webhook_secret TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS sync_state (
      repo_id TEXT PRIMARY KEY REFERENCES repo_connections(id) ON DELETE CASCADE,
      status TEXT NOT NULL DEFAULT 'idle',
      last_synced_at TIMESTAMPTZ,
      last_error TEXT,
      processing_ms INTEGER,
      github_delivery_id TEXT,
      notion_event_id TEXT,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS sync_events (
      id BIGSERIAL PRIMARY KEY,
      repo_id TEXT NOT NULL REFERENCES repo_connections(id) ON DELETE CASCADE,
      source TEXT NOT NULL,
      event_type TEXT NOT NULL,
      detail JSONB,
      status TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS item_mappings (
      id BIGSERIAL PRIMARY KEY,
      repo_id TEXT NOT NULL REFERENCES repo_connections(id) ON DELETE CASCADE,
      item_type TEXT NOT NULL,
      github_id TEXT NOT NULL,
      github_number INTEGER,
      notion_page_id TEXT,
      notion_block_id TEXT,
      title TEXT,
      status TEXT,
      last_synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (repo_id, item_type, github_id)
    )
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS item_mappings_repo_item_idx
    ON item_mappings(repo_id, item_type, github_number)
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS stripe_payments (
      session_id TEXT PRIMARY KEY,
      customer_email TEXT,
      status TEXT NOT NULL,
      amount_total BIGINT,
      currency TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      paid_at TIMESTAMPTZ
    )
  `);

  schemaReady = true;
}

export async function saveRepoConnection(input: {
  repoFullName: string;
  githubToken: string;
  notionToken: string;
  notionDatabaseId: string;
  githubWebhookSecret: string;
  notionWebhookSecret: string;
}) {
  await ensureSchema();

  const [repoOwner, repoName] = input.repoFullName.split("/");
  if (!repoOwner || !repoName) {
    throw new Error("repoFullName must be owner/repo");
  }

  const existing = await query<RepoConnection>(
    `SELECT * FROM repo_connections WHERE repo_full_name = $1 LIMIT 1`,
    [input.repoFullName]
  );

  if (existing.rowCount && existing.rows[0]) {
    const updated = await query<RepoConnection>(
      `
      UPDATE repo_connections
      SET github_token = $2,
          notion_token = $3,
          notion_database_id = $4,
          github_webhook_secret = $5,
          notion_webhook_secret = $6,
          updated_at = NOW()
      WHERE repo_full_name = $1
      RETURNING *
      `,
      [
        input.repoFullName,
        input.githubToken,
        input.notionToken,
        input.notionDatabaseId,
        input.githubWebhookSecret,
        input.notionWebhookSecret
      ]
    );

    return updated.rows[0];
  }

  const inserted = await query<RepoConnection>(
    `
    INSERT INTO repo_connections (
      id,
      repo_owner,
      repo_name,
      repo_full_name,
      github_token,
      notion_token,
      notion_database_id,
      github_webhook_secret,
      notion_webhook_secret
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
    RETURNING *
    `,
    [
      randomUUID(),
      repoOwner,
      repoName,
      input.repoFullName,
      input.githubToken,
      input.notionToken,
      input.notionDatabaseId,
      input.githubWebhookSecret,
      input.notionWebhookSecret
    ]
  );

  return inserted.rows[0];
}

export async function listRepoConnections() {
  await ensureSchema();

  const result = await query<RepoConnection>(
    `SELECT * FROM repo_connections ORDER BY updated_at DESC`
  );

  return result.rows;
}

export async function getRepoConnectionById(repoId: string) {
  await ensureSchema();

  const result = await query<RepoConnection>(
    `SELECT * FROM repo_connections WHERE id = $1 LIMIT 1`,
    [repoId]
  );

  return result.rows[0] ?? null;
}

export async function getRepoConnectionByFullName(repoFullName: string) {
  await ensureSchema();

  const result = await query<RepoConnection>(
    `SELECT * FROM repo_connections WHERE repo_full_name = $1 LIMIT 1`,
    [repoFullName]
  );

  return result.rows[0] ?? null;
}

export async function getRepoConnectionByDatabase(databaseId: string) {
  await ensureSchema();

  const result = await query<RepoConnection>(
    `SELECT * FROM repo_connections WHERE notion_database_id = $1 LIMIT 1`,
    [databaseId]
  );

  return result.rows[0] ?? null;
}

export async function upsertItemMapping(input: {
  repoId: string;
  itemType: string;
  githubId: string;
  githubNumber?: number | null;
  notionPageId?: string | null;
  notionBlockId?: string | null;
  title?: string | null;
  status?: string | null;
}) {
  await ensureSchema();

  const result = await query(
    `
    INSERT INTO item_mappings (
      repo_id,
      item_type,
      github_id,
      github_number,
      notion_page_id,
      notion_block_id,
      title,
      status,
      last_synced_at,
      updated_at
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,NOW(),NOW())
    ON CONFLICT (repo_id, item_type, github_id)
    DO UPDATE SET
      github_number = COALESCE(EXCLUDED.github_number, item_mappings.github_number),
      notion_page_id = COALESCE(EXCLUDED.notion_page_id, item_mappings.notion_page_id),
      notion_block_id = COALESCE(EXCLUDED.notion_block_id, item_mappings.notion_block_id),
      title = COALESCE(EXCLUDED.title, item_mappings.title),
      status = COALESCE(EXCLUDED.status, item_mappings.status),
      last_synced_at = NOW(),
      updated_at = NOW()
    RETURNING *
    `,
    [
      input.repoId,
      input.itemType,
      input.githubId,
      input.githubNumber ?? null,
      input.notionPageId ?? null,
      input.notionBlockId ?? null,
      input.title ?? null,
      input.status ?? null
    ]
  );

  return result.rows[0];
}

export async function findMappingByGitHubId(repoId: string, itemType: string, githubId: string) {
  await ensureSchema();

  const result = await query(
    `
    SELECT * FROM item_mappings
    WHERE repo_id = $1 AND item_type = $2 AND github_id = $3
    LIMIT 1
    `,
    [repoId, itemType, githubId]
  );

  return result.rows[0] ?? null;
}

export async function findMappingByNumber(repoId: string, itemType: string, githubNumber: number) {
  await ensureSchema();

  const result = await query(
    `
    SELECT * FROM item_mappings
    WHERE repo_id = $1 AND item_type = $2 AND github_number = $3
    LIMIT 1
    `,
    [repoId, itemType, githubNumber]
  );

  return result.rows[0] ?? null;
}

export async function findMappingByNotionPage(repoId: string, notionPageId: string) {
  await ensureSchema();

  const result = await query(
    `
    SELECT * FROM item_mappings
    WHERE repo_id = $1 AND notion_page_id = $2
    ORDER BY CASE WHEN item_type = 'comment' THEN 1 ELSE 0 END, id DESC
    LIMIT 1
    `,
    [repoId, notionPageId]
  );

  return result.rows[0] ?? null;
}

export async function findCommentMappingByNotionBlock(repoId: string, notionBlockId: string) {
  await ensureSchema();

  const result = await query(
    `
    SELECT * FROM item_mappings
    WHERE repo_id = $1
      AND item_type = 'comment'
      AND notion_block_id = $2
    LIMIT 1
    `,
    [repoId, notionBlockId]
  );

  return result.rows[0] ?? null;
}

export async function deleteCommentMapping(repoId: string, githubCommentId: string) {
  await ensureSchema();

  await query(
    `
    DELETE FROM item_mappings
    WHERE repo_id = $1
      AND item_type = 'comment'
      AND github_id = $2
    `,
    [repoId, githubCommentId]
  );
}

export async function logSyncEvent(input: {
  repoId: string;
  source: string;
  eventType: string;
  detail?: unknown;
  status: "ok" | "error";
}) {
  await ensureSchema();

  await query(
    `
    INSERT INTO sync_events (repo_id, source, event_type, detail, status)
    VALUES ($1, $2, $3, $4, $5)
    `,
    [input.repoId, input.source, input.eventType, JSON.stringify(input.detail ?? {}), input.status]
  );
}

export async function updateSyncState(input: {
  repoId: string;
  status: string;
  lastError?: string | null;
  processingMs?: number | null;
  githubDeliveryId?: string | null;
  notionEventId?: string | null;
  touched?: boolean;
}) {
  await ensureSchema();

  await query(
    `
    INSERT INTO sync_state (
      repo_id,
      status,
      last_synced_at,
      last_error,
      processing_ms,
      github_delivery_id,
      notion_event_id,
      updated_at
    )
    VALUES ($1, $2, CASE WHEN $3 THEN NOW() ELSE NULL END, $4, $5, $6, $7, NOW())
    ON CONFLICT (repo_id)
    DO UPDATE SET
      status = EXCLUDED.status,
      last_synced_at = CASE WHEN $3 THEN NOW() ELSE sync_state.last_synced_at END,
      last_error = EXCLUDED.last_error,
      processing_ms = EXCLUDED.processing_ms,
      github_delivery_id = COALESCE(EXCLUDED.github_delivery_id, sync_state.github_delivery_id),
      notion_event_id = COALESCE(EXCLUDED.notion_event_id, sync_state.notion_event_id),
      updated_at = NOW()
    `,
    [
      input.repoId,
      input.status,
      input.touched ?? false,
      input.lastError ?? null,
      input.processingMs ?? null,
      input.githubDeliveryId ?? null,
      input.notionEventId ?? null
    ]
  );
}

export async function getRepoRuntime(repoId: string) {
  await ensureSchema();

  const [stateRes, eventsRes] = await Promise.all([
    query<SyncState>(`SELECT * FROM sync_state WHERE repo_id = $1 LIMIT 1`, [repoId]),
    query<SyncEvent>(
      `SELECT * FROM sync_events WHERE repo_id = $1 ORDER BY created_at DESC LIMIT 10`,
      [repoId]
    )
  ]);

  return {
    state: stateRes.rows[0] ?? null,
    events: eventsRes.rows
  };
}

export async function saveStripePayment(input: {
  sessionId: string;
  customerEmail?: string | null;
  status: string;
  amountTotal?: number | null;
  currency?: string | null;
}) {
  await ensureSchema();

  await query(
    `
    INSERT INTO stripe_payments (
      session_id,
      customer_email,
      status,
      amount_total,
      currency,
      paid_at
    ) VALUES ($1, $2, $3, $4, $5, CASE WHEN $3 = 'paid' THEN NOW() ELSE NULL END)
    ON CONFLICT (session_id)
    DO UPDATE SET
      customer_email = COALESCE(EXCLUDED.customer_email, stripe_payments.customer_email),
      status = EXCLUDED.status,
      amount_total = COALESCE(EXCLUDED.amount_total, stripe_payments.amount_total),
      currency = COALESCE(EXCLUDED.currency, stripe_payments.currency),
      paid_at = CASE WHEN EXCLUDED.status = 'paid' THEN NOW() ELSE stripe_payments.paid_at END
    `,
    [
      input.sessionId,
      input.customerEmail ?? null,
      input.status,
      input.amountTotal ?? null,
      input.currency ?? null
    ]
  );
}

export async function findPaidSession(sessionId: string) {
  await ensureSchema();

  const result = await query<{ session_id: string; customer_email: string | null; status: string }>(
    `
    SELECT session_id, customer_email, status
    FROM stripe_payments
    WHERE session_id = $1
    LIMIT 1
    `,
    [sessionId]
  );

  const row = result.rows[0];
  if (!row || row.status !== "paid") {
    return null;
  }

  return row;
}
