"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowUpRight, CheckCircle2, Save, Zap } from "lucide-react";
import toast from "react-hot-toast";
import useSWR from "swr";

import { DatabaseSelector } from "@/components/DatabaseSelector";
import { RepoSelector } from "@/components/RepoSelector";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const fetcher = async (url: string) => {
  const response = await fetch(url);
  const json = (await response.json()) as {
    config?: {
      githubRepo: string;
      notionDatabaseId: string;
      syncEnabled: boolean;
      githubConnected: boolean;
      notionConnected: boolean;
      githubWebhookConfigured: boolean;
      notionWebhookConfigured: boolean;
    };
    error?: string;
  };

  if (!response.ok) {
    throw new Error(json.error || "Failed to load configuration.");
  }

  return json;
};

export function SetupPanel() {
  const { data, error, isLoading, mutate } = useSWR("/api/config", fetcher);

  const [githubToken, setGithubToken] = useState("");
  const [githubRepo, setGithubRepo] = useState("");
  const [githubWebhookSecret, setGithubWebhookSecret] = useState("");
  const [notionToken, setNotionToken] = useState("");
  const [notionDatabaseId, setNotionDatabaseId] = useState("");
  const [notionWebhookSecret, setNotionWebhookSecret] = useState("");
  const [syncEnabled, setSyncEnabled] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!data?.config) {
      return;
    }

    setGithubRepo(data.config.githubRepo || "");
    setNotionDatabaseId(data.config.notionDatabaseId || "");
    setSyncEnabled(data.config.syncEnabled);
  }, [data]);

  const baseWebhookUrl = useMemo(() => {
    if (typeof window === "undefined") {
      return "";
    }

    return `${window.location.origin}/api/webhooks`;
  }, []);

  const saveConfig = async () => {
    setSaving(true);

    const promise = fetch("/api/config", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        githubToken,
        githubRepo,
        githubWebhookSecret,
        notionToken,
        notionDatabaseId,
        notionWebhookSecret,
        syncEnabled
      })
    }).then(async (response) => {
      const json = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(json.error || "Failed to save configuration.");
      }

      return json;
    });

    toast.promise(promise, {
      loading: "Saving integration config...",
      success: "Configuration saved.",
      error: (message) => String(message)
    });

    try {
      await promise;
      setGithubToken("");
      setNotionToken("");
      await mutate();
    } finally {
      setSaving(false);
    }
  };

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
        throw new Error(json.error || "Backfill failed.");
      }

      return json;
    });

    toast.promise(promise, {
      loading: "Syncing latest GitHub items...",
      success: (result) => `Backfill complete: ${result.processed || 0} items synced.`,
      error: (message) => String(message)
    });

    await promise;
  };

  return (
    <div className="space-y-6">
      <Card className="border border-border/60 bg-card/80">
        <CardHeader>
          <CardTitle className="text-xl">Connect GitHub + Notion</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {isLoading ? <p className="text-sm text-muted-foreground">Loading config...</p> : null}
          {error ? <p className="text-sm text-[#ff7b72]">{error.message}</p> : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <a
              href="/api/auth/github"
              className="rounded-md border border-border/60 bg-background/60 px-4 py-3 text-sm transition hover:border-[#2f81f7]/50"
            >
              <p className="font-medium text-foreground">Connect with GitHub OAuth</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Recommended for fast setup. Grants repo read/write for issue sync.
              </p>
              <span className="mt-2 inline-flex items-center gap-1 text-xs text-[#58a6ff]">
                Start OAuth <ArrowUpRight className="size-3" />
              </span>
            </a>

            <a
              href="/api/auth/notion"
              className="rounded-md border border-border/60 bg-background/60 px-4 py-3 text-sm transition hover:border-[#2f81f7]/50"
            >
              <p className="font-medium text-foreground">Connect with Notion OAuth</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Recommended for secure access to workspace databases you select.
              </p>
              <span className="mt-2 inline-flex items-center gap-1 text-xs text-[#58a6ff]">
                Start OAuth <ArrowUpRight className="size-3" />
              </span>
            </a>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="github-token">GitHub Token (optional if OAuth connected)</Label>
              <Input
                id="github-token"
                type="password"
                placeholder="ghp_..."
                value={githubToken}
                onChange={(event) => setGithubToken(event.target.value)}
              />
              {data?.config?.githubConnected ? (
                <p className="inline-flex items-center gap-1 text-xs text-[#7ee787]">
                  <CheckCircle2 className="size-3.5" />
                  Token connected
                </p>
              ) : null}
            </div>

            <div className="space-y-2">
              <Label htmlFor="notion-token">Notion Token (optional if OAuth connected)</Label>
              <Input
                id="notion-token"
                type="password"
                placeholder="secret_..."
                value={notionToken}
                onChange={(event) => setNotionToken(event.target.value)}
              />
              {data?.config?.notionConnected ? (
                <p className="inline-flex items-center gap-1 text-xs text-[#7ee787]">
                  <CheckCircle2 className="size-3.5" />
                  Token connected
                </p>
              ) : null}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <RepoSelector value={githubRepo} onChange={setGithubRepo} disabled={saving} />
            <DatabaseSelector value={notionDatabaseId} onChange={setNotionDatabaseId} disabled={saving} />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="github-webhook-secret">GitHub Webhook Secret</Label>
              <Input
                id="github-webhook-secret"
                type="password"
                value={githubWebhookSecret}
                onChange={(event) => setGithubWebhookSecret(event.target.value)}
                placeholder="Use same value in GitHub webhook settings"
              />
              <p className="text-xs text-muted-foreground">
                Webhook endpoint: <code>{baseWebhookUrl}/github</code>
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notion-webhook-secret">Notion Webhook Secret</Label>
              <Input
                id="notion-webhook-secret"
                type="password"
                value={notionWebhookSecret}
                onChange={(event) => setNotionWebhookSecret(event.target.value)}
                placeholder="Use same value in Notion webhook settings"
              />
              <p className="text-xs text-muted-foreground">
                Webhook endpoint: <code>{baseWebhookUrl}/notion</code>
              </p>
            </div>
          </div>

          <label className="inline-flex items-center gap-2 text-sm text-foreground">
            <input
              type="checkbox"
              className="size-4 rounded border border-border bg-background"
              checked={syncEnabled}
              onChange={(event) => setSyncEnabled(event.target.checked)}
            />
            Keep real-time sync enabled (recommended)
          </label>

          <div className="flex flex-wrap gap-2">
            <Button onClick={saveConfig} disabled={saving}>
              <Save className="mr-1 size-3.5" />
              Save Configuration
            </Button>
            <Button variant="outline" onClick={runBackfill}>
              <Zap className="mr-1 size-3.5" />
              Run Initial Backfill
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
