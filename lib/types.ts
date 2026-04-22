export type SyncSource = "github" | "notion" | "stripe" | "system";

export type SyncEntity = "issue" | "pull_request" | "comment";

export type SyncOutcome = "processed" | "skipped" | "failed";

export interface IntegrationConfig {
  githubToken: string;
  githubRepo: string;
  githubWebhookSecret: string;
  notionToken: string;
  notionDatabaseId: string;
  notionWebhookSecret: string;
  syncEnabled: boolean;
}

export interface SyncLink {
  key: string;
  githubType: "issue" | "pull_request";
  githubNumber: number;
  notionPageId: string;
  lastGithubUpdatedAt?: string;
  lastNotionUpdatedAt?: string;
  lastConflictWinner: "github" | "notion";
  updatedAt: string;
}

export interface SyncEvent {
  id: string;
  source: SyncSource;
  entity: SyncEntity;
  action: string;
  outcome: SyncOutcome;
  summary: string;
  createdAt: string;
  latencyMs?: number;
  metadata?: Record<string, unknown>;
}

export interface PurchaseRecord {
  email: string;
  paidAt: string;
  source: "stripe";
  stripeEventId: string;
  amountTotal?: number;
  currency?: string;
}

export interface AppState {
  config: IntegrationConfig;
  links: Record<string, SyncLink>;
  events: SyncEvent[];
  purchases: PurchaseRecord[];
  processedWebhookIds: string[];
  syncedCommentIds: string[];
}

export interface SanitizedConfig {
  githubRepo: string;
  notionDatabaseId: string;
  syncEnabled: boolean;
  githubConnected: boolean;
  notionConnected: boolean;
  githubWebhookConfigured: boolean;
  notionWebhookConfigured: boolean;
}
