"use client";

import useSWR from "swr";
import { CheckCircle2, LoaderCircle, RefreshCw, TriangleAlert, XCircle } from "lucide-react";
import toast from "react-hot-toast";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type SyncEvent = {
  id: string;
  source: "github" | "notion" | "stripe" | "system";
  entity: "issue" | "pull_request" | "comment";
  action: string;
  outcome: "processed" | "skipped" | "failed";
  summary: string;
  createdAt: string;
  latencyMs?: number;
};

type SyncStatusResponse = {
  config: {
    syncEnabled: boolean;
    githubConnected: boolean;
    notionConnected: boolean;
    githubWebhookConfigured: boolean;
    notionWebhookConfigured: boolean;
    githubRepo: string;
    notionDatabaseId: string;
  };
  totals: {
    links: number;
    events: number;
    purchases: number;
  };
  latestEvents: SyncEvent[];
  error?: string;
};

const fetcher = async (url: string): Promise<SyncStatusResponse> => {
  const response = await fetch(url);
  const json = (await response.json()) as SyncStatusResponse;

  if (!response.ok) {
    throw new Error(json.error || "Failed to load status.");
  }

  return json;
};

function OutcomeBadge({ outcome }: { outcome: SyncEvent["outcome"] }) {
  if (outcome === "processed") {
    return <Badge className="bg-[#238636]/20 text-[#7ee787]">processed</Badge>;
  }

  if (outcome === "skipped") {
    return <Badge className="bg-[#d29922]/20 text-[#f2cc60]">skipped</Badge>;
  }

  return <Badge className="bg-[#da3633]/20 text-[#ff7b72]">failed</Badge>;
}

export function SyncStatus() {
  const { data, error, isLoading, mutate } = useSWR<SyncStatusResponse>("/api/sync/status", fetcher, {
    refreshInterval: 3000
  });

  const runBackfill = async () => {
    const promise = fetch("/api/sync/run", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ limit: 30 })
    }).then(async (response) => {
      const json = (await response.json()) as { error?: string; processed?: number };

      if (!response.ok) {
        throw new Error(json.error || "Manual sync failed.");
      }

      return json;
    });

    toast.promise(promise, {
      loading: "Running backfill from GitHub...",
      success: (result) => `Backfill complete: ${result.processed || 0} items synced.`,
      error: (message) => String(message)
    });

    await promise;
    await mutate();
  };

  if (isLoading) {
    return (
      <Card className="border border-border/60 bg-card/70">
        <CardContent className="flex items-center gap-3 py-6">
          <LoaderCircle className="size-4 animate-spin text-[#2f81f7]" />
          <p className="text-sm text-muted-foreground">Loading sync state...</p>
        </CardContent>
      </Card>
    );
  }

  if (error || !data) {
    return (
      <Card className="border border-[#da3633]/40 bg-[#2d1213]/60">
        <CardContent className="flex items-center gap-3 py-6">
          <XCircle className="size-4 text-[#ff7b72]" />
          <p className="text-sm text-[#ffb4ad]">
            {error?.message || "Unable to load sync status. Check API auth + setup."}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card className="border border-border/60 bg-card/70">
        <CardHeader>
          <CardTitle className="flex items-center justify-between text-lg">
            <span>Sync Health</span>
            <div className="flex items-center gap-2">
              {data.config.syncEnabled ? (
                <Badge className="bg-[#238636]/20 text-[#7ee787]">enabled</Badge>
              ) : (
                <Badge className="bg-[#d29922]/20 text-[#f2cc60]">paused</Badge>
              )}
              <Button variant="outline" size="sm" onClick={runBackfill}>
                <RefreshCw className="mr-1 size-3.5" />
                Backfill
              </Button>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-lg border border-border/60 bg-background/60 p-3">
              <p className="text-xs text-muted-foreground">Mapped Items</p>
              <p className="text-xl font-semibold text-foreground">{data.totals.links}</p>
            </div>
            <div className="rounded-lg border border-border/60 bg-background/60 p-3">
              <p className="text-xs text-muted-foreground">Webhook Events</p>
              <p className="text-xl font-semibold text-foreground">{data.totals.events}</p>
            </div>
            <div className="rounded-lg border border-border/60 bg-background/60 p-3">
              <p className="text-xs text-muted-foreground">Paying Accounts</p>
              <p className="text-xl font-semibold text-foreground">{data.totals.purchases}</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs">
            {data.config.githubConnected ? (
              <Badge className="bg-[#238636]/20 text-[#7ee787]">GitHub token connected</Badge>
            ) : (
              <Badge className="bg-[#da3633]/20 text-[#ff7b72]">GitHub token missing</Badge>
            )}
            {data.config.notionConnected ? (
              <Badge className="bg-[#238636]/20 text-[#7ee787]">Notion token connected</Badge>
            ) : (
              <Badge className="bg-[#da3633]/20 text-[#ff7b72]">Notion token missing</Badge>
            )}
            {data.config.githubWebhookConfigured ? (
              <Badge className="bg-[#238636]/20 text-[#7ee787]">GitHub webhook secret set</Badge>
            ) : (
              <Badge className="bg-[#d29922]/20 text-[#f2cc60]">GitHub webhook secret missing</Badge>
            )}
            {data.config.notionWebhookConfigured ? (
              <Badge className="bg-[#238636]/20 text-[#7ee787]">Notion webhook secret set</Badge>
            ) : (
              <Badge className="bg-[#d29922]/20 text-[#f2cc60]">Notion webhook secret missing</Badge>
            )}
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium text-foreground">Latest events</p>
            {data.latestEvents.length === 0 ? (
              <div className="rounded-md border border-dashed border-border/60 bg-background/40 p-3 text-sm text-muted-foreground">
                Webhook activity will appear here once events arrive.
              </div>
            ) : (
              <div className="space-y-2">
                {data.latestEvents.slice(0, 8).map((event) => (
                  <div
                    key={event.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border/60 bg-background/60 px-3 py-2"
                  >
                    <div className="flex items-center gap-2 text-sm">
                      {event.outcome === "processed" ? (
                        <CheckCircle2 className="size-4 text-[#7ee787]" />
                      ) : event.outcome === "skipped" ? (
                        <TriangleAlert className="size-4 text-[#f2cc60]" />
                      ) : (
                        <XCircle className="size-4 text-[#ff7b72]" />
                      )}
                      <span className="text-foreground">{event.summary}</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <OutcomeBadge outcome={event.outcome} />
                      <span>{new Date(event.createdAt).toLocaleTimeString()}</span>
                      {event.latencyMs ? <span>{event.latencyMs}ms</span> : null}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
