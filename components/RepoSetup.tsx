"use client";

import { useMemo, useState } from "react";
import { Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface RepoSetupProps {
  defaultRepoFullName?: string;
  onConfigured: (repoFullName: string) => void;
}

interface SyncResponse {
  ok: boolean;
  repoFullName: string;
  syncResult: {
    synced: number;
    tookMs: number;
  } | null;
}

function repoToKey(repoFullName: string) {
  return repoFullName.trim().toLowerCase().replace("/", "__");
}

export function RepoSetup({ defaultRepoFullName, onConfigured }: RepoSetupProps) {
  const [repoFullName, setRepoFullName] = useState(defaultRepoFullName || "");
  const [githubToken, setGithubToken] = useState("");
  const [notionToken, setNotionToken] = useState("");
  const [notionDatabaseId, setNotionDatabaseId] = useState("");
  const [syncNow, setSyncNow] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const webhookUrls = useMemo(() => {
    if (typeof window === "undefined") {
      return {
        githubWebhook: "/api/webhooks/github",
        notionWebhook: "/api/webhooks/notion"
      };
    }

    const origin = window.location.origin;
    return {
      githubWebhook: `${origin}/api/webhooks/github`,
      notionWebhook: `${origin}/api/webhooks/notion`
    };
  }, []);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setError(null);
    setMessage(null);
    setIsSaving(true);

    const cleanedRepo = repoFullName.trim();
    const repoKey = repoToKey(cleanedRepo);

    try {
      const response = await fetch(`/api/sync/${repoKey}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          repoFullName: cleanedRepo,
          githubToken: githubToken.trim() || undefined,
          notionToken: notionToken.trim() || undefined,
          notionDatabaseId: notionDatabaseId.trim() || undefined,
          syncNow
        })
      });

      const payload = (await response.json()) as Partial<SyncResponse> & { message?: string };

      if (!response.ok || !payload.ok) {
        throw new Error(payload.message || "Could not save repository settings.");
      }

      setMessage(
        payload.syncResult
          ? `Sync completed: ${payload.syncResult.synced} items in ${payload.syncResult.tookMs} ms.`
          : "Configuration saved."
      );

      onConfigured(cleanedRepo);
      setGithubToken("");
      setNotionToken("");
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Setup failed.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Connect your repo and Notion database</CardTitle>
        <CardDescription>
          This product is intentionally single-repo: one GitHub repository + one Notion database for fast, predictable sync.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <label className="text-sm font-medium text-[#c9d1d9]" htmlFor="repoFullName">
              GitHub repository
            </label>
            <input
              className="h-10 w-full rounded-lg border border-[#30363d] bg-[#0d1117] px-3 text-sm text-[#f0f6fc] outline-none focus:border-[#2f81f7]"
              id="repoFullName"
              onChange={(event) => setRepoFullName(event.target.value)}
              placeholder="owner/repository"
              required
              value={repoFullName}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-[#c9d1d9]" htmlFor="githubToken">
              GitHub token (repo scope)
            </label>
            <input
              className="h-10 w-full rounded-lg border border-[#30363d] bg-[#0d1117] px-3 text-sm text-[#f0f6fc] outline-none focus:border-[#2f81f7]"
              id="githubToken"
              onChange={(event) => setGithubToken(event.target.value)}
              placeholder="ghp_..."
              type="password"
              value={githubToken}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-[#c9d1d9]" htmlFor="notionToken">
              Notion integration token
            </label>
            <input
              className="h-10 w-full rounded-lg border border-[#30363d] bg-[#0d1117] px-3 text-sm text-[#f0f6fc] outline-none focus:border-[#2f81f7]"
              id="notionToken"
              onChange={(event) => setNotionToken(event.target.value)}
              placeholder="secret_..."
              type="password"
              value={notionToken}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-[#c9d1d9]" htmlFor="notionDatabaseId">
              Notion database ID
            </label>
            <input
              className="h-10 w-full rounded-lg border border-[#30363d] bg-[#0d1117] px-3 text-sm text-[#f0f6fc] outline-none focus:border-[#2f81f7]"
              id="notionDatabaseId"
              onChange={(event) => setNotionDatabaseId(event.target.value)}
              placeholder="32-character database ID"
              required
              value={notionDatabaseId}
            />
          </div>

          <label className="flex items-center gap-2 text-sm text-[#c9d1d9]">
            <input
              checked={syncNow}
              className="h-4 w-4 rounded border-[#30363d] bg-[#0d1117]"
              onChange={(event) => setSyncNow(event.target.checked)}
              type="checkbox"
            />
            Pull current issues and pull requests immediately after save.
          </label>

          <Button className="w-full" disabled={isSaving} size="lg" type="submit">
            {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
            Save and start sync
          </Button>

          {message ? <p className="text-sm text-[#58a6ff]">{message}</p> : null}
          {error ? <p className="text-sm text-[#ff7b72]">{error}</p> : null}
        </form>

        <div className="mt-6 rounded-xl border border-[#30363d] bg-[#0d1117] p-4 text-sm text-[#8b949e]">
          <p className="font-medium text-[#c9d1d9]">Webhook endpoints to configure:</p>
          <p className="mt-2">GitHub: {webhookUrls.githubWebhook}</p>
          <p className="mt-1">Notion: {webhookUrls.notionWebhook}</p>
        </div>
      </CardContent>
    </Card>
  );
}
