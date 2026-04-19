import { Pool, type QueryResultRow } from "pg";

export interface RepoSyncConfig {
  sessionId: string;
  repoFullName: string;
  githubToken: string;
  notionToken: string;
  notionDatabaseId: string;
  createdAt: string;
  updatedAt: string;
}

export interface SyncMapping {
  id: number;
  sessionId: string;
  repoFullName: string;
  itemType: "issue" | "pull_request" | "comment";
  githubItemId: string;
  githubNumber: number | null;
  notionPageId: string;
  notionCommentId: string | null;
  itemStatus: string | null;
  updatedAt: string;
}

export interface SyncStatus {
  sessionId: string;
  repoFullName: string;
  lastGithubEventAt: string | null;
  lastNotionEventAt: string | null;
  lastLatencyMs: number | null;
  lastError: string | null;
  updatedAt: string;
}

interface RepoSyncConfigRow extends QueryResultRow {
  session_id: string;
  repo_full_name: string;
  github_token: string;
  notion_token: string;
  notion_database_id: string;
  created_at: string;
  updated_at: string;
}

interface SyncMappingRow extends QueryResultRow {
  id: number;
  session_id: string;
  repo_full_name: string;
  item_type: "issue" | "pull_request" | "comment";
  github_item_id: string;
  github_number: number | null;
  notion_page_id: string;
  notion_comment_id: string | null;
  item_status: string | null;
  updated_at: string;
}

interface SyncStatusRow extends QueryResultRow {
  session_id: string;
  repo_full_name: string;
  last_github_event_at: string | null;
  last_notion_event_at: string | null;
  last_latency_ms: number | null;
  last_error: string | null;
  updated_at: string;
}

interface PaymentRow extends QueryResultRow {
  session_id: string;
  order_id: string;
  status: string;
  paid_at: string | null;
  updated_at: string;
}

const globalForDb = globalThis as unknown as {
  gtnPool?: Pool;
  gtnSchemaReady?: Promise<void>;
};

function getPool() {
  if (!globalForDb.gtnPool) {
    const connectionString = process.env.DATABASE_URL;

    if (!connectionString) {
      throw new Error("DATABASE_URL is required to use sync and paywall APIs.");
    }

    globalForDb.gtnPool = new Pool({
      connectionString,
      ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : undefined
    });
  }

  return globalForDb.gtnPool;
}

const schemaSql = `
CREATE TABLE IF NOT EXISTS repo_sync_configs (
  session_id TEXT PRIMARY KEY,
  repo_full_name TEXT UNIQUE NOT NULL,
  github_token TEXT NOT NULL,
  notion_token TEXT NOT NULL,
  notion_database_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sync_mappings (
  id BIGSERIAL PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES repo_sync_configs(session_id) ON DELETE CASCADE,
  repo_full_name TEXT NOT NULL,
  item_type TEXT NOT NULL CHECK (item_type IN ('issue', 'pull_request', 'comment')),
  github_item_id TEXT NOT NULL,
  github_number INTEGER,
  notion_page_id TEXT NOT NULL,
  notion_comment_id TEXT,
  item_status TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (repo_full_name, item_type, github_item_id)
);

CREATE TABLE IF NOT EXISTS sync_status (
  session_id TEXT PRIMARY KEY REFERENCES repo_sync_configs(session_id) ON DELETE CASCADE,
  repo_full_name TEXT NOT NULL,
  last_github_event_at TIMESTAMPTZ,
  last_notion_event_at TIMESTAMPTZ,
  last_latency_ms INTEGER,
  last_error TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sync_events (
  id BIGSERIAL PRIMARY KEY,
  session_id TEXT,
  source TEXT NOT NULL,
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS payment_sessions (
  session_id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL,
  status TEXT NOT NULL,
  paid_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
`;

export async function ensureSchema() {
  if (!globalForDb.gtnSchemaReady) {
    const db = getPool();
    globalForDb.gtnSchemaReady = db.query(schemaSql).then(() => undefined);
  }

  await globalForDb.gtnSchemaReady;
}

function mapRepoConfig(row: RepoSyncConfigRow): RepoSyncConfig {
  return {
    sessionId: row.session_id,
    repoFullName: row.repo_full_name,
    githubToken: row.github_token,
    notionToken: row.notion_token,
    notionDatabaseId: row.notion_database_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapSyncMapping(row: SyncMappingRow): SyncMapping {
  return {
    id: row.id,
    sessionId: row.session_id,
    repoFullName: row.repo_full_name,
    itemType: row.item_type,
    githubItemId: row.github_item_id,
    githubNumber: row.github_number,
    notionPageId: row.notion_page_id,
    notionCommentId: row.notion_comment_id,
    itemStatus: row.item_status,
    updatedAt: row.updated_at
  };
}

function mapSyncStatus(row: SyncStatusRow): SyncStatus {
  return {
    sessionId: row.session_id,
    repoFullName: row.repo_full_name,
    lastGithubEventAt: row.last_github_event_at,
    lastNotionEventAt: row.last_notion_event_at,
    lastLatencyMs: row.last_latency_ms,
    lastError: row.last_error,
    updatedAt: row.updated_at
  };
}

export async function upsertRepoConfig(params: {
  sessionId: string;
  repoFullName: string;
  githubToken: string;
  notionToken: string;
  notionDatabaseId: string;
}) {
  await ensureSchema();
  const db = getPool();
  const result = await db.query<RepoSyncConfigRow>(
    `
      INSERT INTO repo_sync_configs (
        session_id,
        repo_full_name,
        github_token,
        notion_token,
        notion_database_id,
        updated_at
      )
      VALUES ($1, $2, $3, $4, $5, NOW())
      ON CONFLICT (session_id)
      DO UPDATE SET
        repo_full_name = EXCLUDED.repo_full_name,
        github_token = EXCLUDED.github_token,
        notion_token = EXCLUDED.notion_token,
        notion_database_id = EXCLUDED.notion_database_id,
        updated_at = NOW()
      RETURNING *;
    `,
    [params.sessionId, params.repoFullName, params.githubToken, params.notionToken, params.notionDatabaseId]
  );

  return mapRepoConfig(result.rows[0]);
}

export async function getRepoConfigBySession(sessionId: string) {
  await ensureSchema();
  const db = getPool();
  const result = await db.query<RepoSyncConfigRow>(`SELECT * FROM repo_sync_configs WHERE session_id = $1 LIMIT 1;`, [sessionId]);

  if (!result.rows[0]) {
    return null;
  }

  return mapRepoConfig(result.rows[0]);
}

export async function getRepoConfigByRepo(repoFullName: string) {
  await ensureSchema();
  const db = getPool();
  const result = await db.query<RepoSyncConfigRow>(
    `SELECT * FROM repo_sync_configs WHERE lower(repo_full_name) = lower($1) LIMIT 1;`,
    [repoFullName]
  );

  if (!result.rows[0]) {
    return null;
  }

  return mapRepoConfig(result.rows[0]);
}

export async function upsertSyncMapping(params: {
  sessionId: string;
  repoFullName: string;
  itemType: "issue" | "pull_request" | "comment";
  githubItemId: string;
  githubNumber?: number | null;
  notionPageId: string;
  notionCommentId?: string | null;
  itemStatus?: string | null;
}) {
  await ensureSchema();
  const db = getPool();
  const result = await db.query<SyncMappingRow>(
    `
      INSERT INTO sync_mappings (
        session_id,
        repo_full_name,
        item_type,
        github_item_id,
        github_number,
        notion_page_id,
        notion_comment_id,
        item_status,
        updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
      ON CONFLICT (repo_full_name, item_type, github_item_id)
      DO UPDATE SET
        github_number = EXCLUDED.github_number,
        notion_page_id = EXCLUDED.notion_page_id,
        notion_comment_id = EXCLUDED.notion_comment_id,
        item_status = EXCLUDED.item_status,
        updated_at = NOW()
      RETURNING *;
    `,
    [
      params.sessionId,
      params.repoFullName,
      params.itemType,
      params.githubItemId,
      params.githubNumber ?? null,
      params.notionPageId,
      params.notionCommentId ?? null,
      params.itemStatus ?? null
    ]
  );

  return mapSyncMapping(result.rows[0]);
}

export async function getSyncMappingByGitHubItem(params: {
  repoFullName: string;
  itemType: "issue" | "pull_request" | "comment";
  githubItemId: string;
}) {
  await ensureSchema();
  const db = getPool();
  const result = await db.query<SyncMappingRow>(
    `
      SELECT * FROM sync_mappings
      WHERE lower(repo_full_name) = lower($1)
      AND item_type = $2
      AND github_item_id = $3
      LIMIT 1;
    `,
    [params.repoFullName, params.itemType, params.githubItemId]
  );

  if (!result.rows[0]) {
    return null;
  }

  return mapSyncMapping(result.rows[0]);
}

export async function getSyncMappingByNotionPage(notionPageId: string) {
  await ensureSchema();
  const db = getPool();
  const result = await db.query<SyncMappingRow>(
    `SELECT * FROM sync_mappings WHERE notion_page_id = $1 ORDER BY updated_at DESC LIMIT 1;`,
    [notionPageId]
  );

  if (!result.rows[0]) {
    return null;
  }

  return mapSyncMapping(result.rows[0]);
}

export async function saveSyncEvent(params: {
  sessionId: string | null;
  source: "github" | "notion";
  eventType: string;
  payload: unknown;
}) {
  await ensureSchema();
  const db = getPool();
  await db.query(
    `INSERT INTO sync_events (session_id, source, event_type, payload) VALUES ($1, $2, $3, $4);`,
    [params.sessionId, params.source, params.eventType, JSON.stringify(params.payload)]
  );
}

export async function upsertSyncStatus(params: {
  sessionId: string;
  repoFullName: string;
  source: "github" | "notion";
  latencyMs?: number;
  error?: string | null;
}) {
  await ensureSchema();
  const db = getPool();
  const lastGithubEventAt = params.source === "github" ? "NOW()" : "sync_status.last_github_event_at";
  const lastNotionEventAt = params.source === "notion" ? "NOW()" : "sync_status.last_notion_event_at";

  await db.query(
    `
      INSERT INTO sync_status (
        session_id,
        repo_full_name,
        last_github_event_at,
        last_notion_event_at,
        last_latency_ms,
        last_error,
        updated_at
      )
      VALUES (
        $1,
        $2,
        ${params.source === "github" ? "NOW()" : "NULL"},
        ${params.source === "notion" ? "NOW()" : "NULL"},
        $3,
        $4,
        NOW()
      )
      ON CONFLICT (session_id)
      DO UPDATE SET
        repo_full_name = EXCLUDED.repo_full_name,
        last_github_event_at = ${lastGithubEventAt},
        last_notion_event_at = ${lastNotionEventAt},
        last_latency_ms = COALESCE(EXCLUDED.last_latency_ms, sync_status.last_latency_ms),
        last_error = EXCLUDED.last_error,
        updated_at = NOW();
    `,
    [params.sessionId, params.repoFullName, params.latencyMs ?? null, params.error ?? null]
  );
}

export async function getSyncOverview(sessionId: string, repoFullName: string) {
  await ensureSchema();
  const db = getPool();

  const [statusResult, mappingResult] = await Promise.all([
    db.query<SyncStatusRow>(`SELECT * FROM sync_status WHERE session_id = $1 LIMIT 1;`, [sessionId]),
    db.query<{ item_type: "issue" | "pull_request" | "comment"; count: string }>(
      `
        SELECT item_type, COUNT(*)::text AS count
        FROM sync_mappings
        WHERE session_id = $1 AND lower(repo_full_name) = lower($2)
        GROUP BY item_type;
      `,
      [sessionId, repoFullName]
    )
  ]);

  const counts = {
    issue: 0,
    pull_request: 0,
    comment: 0
  };

  for (const row of mappingResult.rows) {
    counts[row.item_type] = Number(row.count);
  }

  return {
    status: statusResult.rows[0] ? mapSyncStatus(statusResult.rows[0]) : null,
    counts
  };
}

export async function upsertPaymentSession(params: {
  sessionId: string;
  orderId: string;
  status: string;
  paidAt?: Date | null;
}) {
  await ensureSchema();
  const db = getPool();

  const result = await db.query<PaymentRow>(
    `
      INSERT INTO payment_sessions (
        session_id,
        order_id,
        status,
        paid_at,
        updated_at
      )
      VALUES ($1, $2, $3, $4, NOW())
      ON CONFLICT (session_id)
      DO UPDATE SET
        order_id = EXCLUDED.order_id,
        status = EXCLUDED.status,
        paid_at = COALESCE(EXCLUDED.paid_at, payment_sessions.paid_at),
        updated_at = NOW()
      RETURNING *;
    `,
    [params.sessionId, params.orderId, params.status, params.paidAt ?? null]
  );

  return result.rows[0];
}

export async function getPaymentSessionBySessionId(sessionId: string) {
  await ensureSchema();
  const db = getPool();
  const result = await db.query<PaymentRow>(`SELECT * FROM payment_sessions WHERE session_id = $1 LIMIT 1;`, [sessionId]);
  return result.rows[0] ?? null;
}

export function normalizeRepoKey(repoFullName: string) {
  return repoFullName.trim().toLowerCase().replace("/", "__");
}

export function repoKeyToFullName(repoKey: string) {
  return repoKey.replace("__", "/");
}
