import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

import type { AppState, IntegrationConfig, SanitizedConfig, SyncEvent, SyncLink } from "@/lib/types";

const dataDir = path.join(process.cwd(), "data");
const stateFile = path.join(dataDir, "state.json");

const defaultConfig: IntegrationConfig = {
  githubToken: "",
  githubRepo: "",
  githubWebhookSecret: "",
  notionToken: "",
  notionDatabaseId: "",
  notionWebhookSecret: "",
  syncEnabled: true
};

const defaultState: AppState = {
  config: defaultConfig,
  links: {},
  events: [],
  purchases: [],
  processedWebhookIds: [],
  syncedCommentIds: []
};

let writeChain: Promise<AppState> = Promise.resolve(defaultState);

async function ensureStateFile(): Promise<void> {
  await fs.mkdir(dataDir, { recursive: true });

  try {
    await fs.access(stateFile);
  } catch {
    await fs.writeFile(stateFile, JSON.stringify(defaultState, null, 2), "utf8");
  }
}

export async function readState(): Promise<AppState> {
  await ensureStateFile();
  const raw = await fs.readFile(stateFile, "utf8");

  try {
    const parsed = JSON.parse(raw) as Partial<AppState>;
    return {
      ...defaultState,
      ...parsed,
      config: {
        ...defaultConfig,
        ...(parsed.config ?? {})
      },
      links: parsed.links ?? {},
      events: parsed.events ?? [],
      purchases: parsed.purchases ?? [],
      processedWebhookIds: parsed.processedWebhookIds ?? [],
      syncedCommentIds: parsed.syncedCommentIds ?? []
    };
  } catch {
    return defaultState;
  }
}

export async function updateState(mutator: (state: AppState) => void | AppState): Promise<AppState> {
  writeChain = writeChain.then(async () => {
    const current = await readState();
    const clone = structuredClone(current) as AppState;
    const next = mutator(clone);
    const finalState = (next ?? clone) as AppState;

    await fs.writeFile(stateFile, JSON.stringify(finalState, null, 2), "utf8");
    return finalState;
  });

  return writeChain;
}

export function sanitizeConfig(config: IntegrationConfig): SanitizedConfig {
  return {
    githubRepo: config.githubRepo,
    notionDatabaseId: config.notionDatabaseId,
    syncEnabled: config.syncEnabled,
    githubConnected: Boolean(config.githubToken),
    notionConnected: Boolean(config.notionToken),
    githubWebhookConfigured: Boolean(config.githubWebhookSecret),
    notionWebhookConfigured: Boolean(config.notionWebhookSecret)
  };
}

export function makeLinkKey(type: "issue" | "pull_request", number: number): string {
  return `${type}:${number}`;
}

export async function upsertLink(link: SyncLink): Promise<void> {
  await updateState((state) => {
    state.links[link.key] = link;
  });
}

export async function addEvent(event: Omit<SyncEvent, "id" | "createdAt">): Promise<SyncEvent> {
  const fullEvent: SyncEvent = {
    id: randomUUID(),
    createdAt: new Date().toISOString(),
    ...event
  };

  await updateState((state) => {
    state.events.unshift(fullEvent);
    state.events = state.events.slice(0, 200);
  });

  return fullEvent;
}
