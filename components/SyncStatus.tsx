"use client";

import { useMemo, useState } from "react";
import useSWR from "swr";
import { Activity, Clock3, GitPullRequest, MessageSquareText, RefreshCcw, TriangleAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface SyncStatusPayload {
  repoFullName: string;
  counts: {
    issue: number;
    pull_request: number;
    comment: number;
  };
  status: {
    lastGithubEventAt: string | null;
    lastNotionEventAt: string | null;
    lastLatencyMs: number | null;
    lastError: string | null;
  } | null;
}

function repoToKey(repoFullName: string) {
  return repoFullName.trim().toLowerCase().replace("/", "__");
}

const fetcher = async (url: string) => {
  const response = await fetch(url, { cache: "no-store" });
  const json = (await response.json()) as SyncStatusPayload & { message?: string };

  if (!response.ok) {
    throw new Error(json.message || "Could not load sync status");
  }

  return json;
};

function formatTimestamp(value: string | null) {
  if (!value) {
    return "Not yet";
  }

  const date = new Date(value);
  return date.toLocaleString();
}

export function SyncStatus({ repoFullName }: { repoFullName: string }) {
  const [isSyncingNow, setIsSyncingNow] = useState(false);
  const repoKey = useMemo(() => repoToKey(repoFullName), [repoFullName]);

  const { data, error, mutate, isLoading } = useSWR<SyncStatusPayload>(`/api/sync/${repoKey}`, fetcher, {
    refreshInterval: 3000,
    revalidateOnFocus: true
  });

  async function triggerSync() {
    setIsSyncingNow(true);

    try {
      const response = await fetch(`/api/sync/${repoKey}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ syncNow: true })
      });

      if (!response.ok) {
        const payload = (await response.json()) as { message?: string };
        throw new Error(payload.message || "Sync request failed");
      }

      await mutate();
    } finally {
      setIsSyncingNow(false);
    }
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Sync status</CardTitle>
          <CardDescription>Unable to read sync status.</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="flex items-center gap-2 text-sm text-[#ff7b72]">
            <TriangleAlert className="h-4 w-4" />
            {error.message}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div>
          <CardTitle>Live sync for {repoFullName}</CardTitle>
          <CardDescription>Webhook-driven updates are processed as events arrive.</CardDescription>
        </div>
        <Button disabled={isLoading || isSyncingNow} onClick={triggerSync} variant="secondary">
          <RefreshCcw className={`mr-2 h-4 w-4 ${isSyncingNow ? "animate-spin" : ""}`} />
          Sync now
        </Button>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <Badge variant="success">Issues: {data?.counts.issue ?? 0}</Badge>
          <Badge variant="neutral">PRs: {data?.counts.pull_request ?? 0}</Badge>
          <Badge variant="warning">Comments: {data?.counts.comment ?? 0}</Badge>
        </div>

        <div className="grid gap-3 text-sm text-[#c9d1d9] md:grid-cols-2">
          <div className="rounded-xl border border-[#30363d] bg-[#0d1117] p-3">
            <p className="mb-1 flex items-center gap-2 text-[#8b949e]">
              <Activity className="h-4 w-4" />
              Last GitHub event
            </p>
            <p>{formatTimestamp(data?.status?.lastGithubEventAt ?? null)}</p>
          </div>

          <div className="rounded-xl border border-[#30363d] bg-[#0d1117] p-3">
            <p className="mb-1 flex items-center gap-2 text-[#8b949e]">
              <MessageSquareText className="h-4 w-4" />
              Last Notion event
            </p>
            <p>{formatTimestamp(data?.status?.lastNotionEventAt ?? null)}</p>
          </div>

          <div className="rounded-xl border border-[#30363d] bg-[#0d1117] p-3">
            <p className="mb-1 flex items-center gap-2 text-[#8b949e]">
              <Clock3 className="h-4 w-4" />
              End-to-end latency
            </p>
            <p>{data?.status?.lastLatencyMs ? `${data.status.lastLatencyMs} ms` : "Waiting for first event"}</p>
          </div>

          <div className="rounded-xl border border-[#30363d] bg-[#0d1117] p-3">
            <p className="mb-1 flex items-center gap-2 text-[#8b949e]">
              <GitPullRequest className="h-4 w-4" />
              Last processing error
            </p>
            <p className={data?.status?.lastError ? "text-[#ff7b72]" : "text-[#58a6ff]"}>
              {data?.status?.lastError || "No errors recorded"}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
