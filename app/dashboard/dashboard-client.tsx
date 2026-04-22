"use client";

import Link from "next/link";
import useSWR from "swr";
import toast from "react-hot-toast";

import { RepoCard, type RepoCardData } from "@/components/RepoCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type RepoResponse = {
  repos: RepoCardData[];
  events: {
    id: number;
    source: string;
    eventType: string;
    status: string;
    createdAt: string;
    detail: string;
  }[];
};

const fetcher = async (url: string) => {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error("Failed to load dashboard data");
  }
  return (await response.json()) as RepoResponse;
};

export function DashboardClient() {
  const { data, mutate, isLoading } = useSWR<RepoResponse>("/api/repos", fetcher, {
    refreshInterval: 5000
  });

  const primaryRepo = data?.repos?.[0];

  const triggerManualSync = async (repoId: string) => {
    const syncPromise = fetch(`/api/sync/${repoId}`, { method: "POST" })
      .then(async (response) => {
        const payload = (await response.json()) as { error?: string };
        if (!response.ok) {
          throw new Error(payload.error ?? "Manual sync failed");
        }
      })
      .then(async () => {
        await mutate();
      });

    await toast.promise(syncPromise, {
      loading: "Running sync...",
      success: "Sync completed",
      error: (error) => (error instanceof Error ? error.message : "Sync failed")
    });
  };

  return (
    <div className="space-y-6">
      <Card className="bg-[#111827]/90">
        <CardHeader>
          <CardTitle>Realtime Sync Health</CardTitle>
          <CardDescription>
            Status badges update every 5 seconds. Webhooks should process in under 3 seconds on healthy infra.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary">Latency target: &lt; 3000ms</Badge>
          <Badge variant="secondary">Mode: webhook-driven</Badge>
          <Badge variant="secondary">Scope: one repo starter</Badge>
        </CardContent>
      </Card>

      {isLoading ? <p className="text-sm text-slate-400">Loading connection status...</p> : null}

      {primaryRepo ? (
        <RepoCard data={primaryRepo} onManualSync={triggerManualSync} syncing={false} />
      ) : (
        <Card className="bg-[#111827]/90">
          <CardHeader>
            <CardTitle>No repository connected yet</CardTitle>
            <CardDescription>
              Complete setup to enable two-way issue, pull request, and comment sync.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link href="/setup">Open setup</Link>
            </Button>
          </CardContent>
        </Card>
      )}

      <Card className="bg-[#111827]/90">
        <CardHeader>
          <CardTitle>Recent Events</CardTitle>
          <CardDescription>Latest webhook and sync events for fast debugging.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {(data?.events ?? []).length === 0 ? (
              <p className="text-sm text-slate-400">No events yet.</p>
            ) : (
              (data?.events ?? []).map((event) => (
                <div key={event.id} className="rounded-lg border border-[#30363d] bg-[#0d1117] p-3 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-medium text-slate-200">
                      {event.source} · {event.eventType}
                    </p>
                    <Badge variant={event.status === "ok" ? "default" : "destructive"}>{event.status}</Badge>
                  </div>
                  <p className="mt-2 text-xs text-slate-400">{new Date(event.createdAt).toLocaleString()}</p>
                  <p className="mt-2 break-words text-xs text-slate-300">{event.detail}</p>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
