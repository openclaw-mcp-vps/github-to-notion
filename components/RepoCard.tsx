"use client";

import { useMemo } from "react";
import { Github, NotepadText, RefreshCw } from "lucide-react";

import { SyncStatus } from "@/components/SyncStatus";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";

export type RepoCardData = {
  id: string;
  repoFullName: string;
  notionDatabaseId: string;
  updatedAt: string;
  status: string;
  lastSyncedAt?: string | null;
  latencyMs?: number | null;
  lastError?: string | null;
};

type RepoCardProps = {
  data: RepoCardData;
  onManualSync: (repoId: string) => Promise<void>;
  syncing: boolean;
};

export function RepoCard({ data, onManualSync, syncing }: RepoCardProps) {
  const webhookUrl = useMemo(() => {
    if (typeof window === "undefined") {
      return "";
    }

    return `${window.location.origin}/api/webhooks/github`;
  }, []);

  return (
    <Card className="border-[#30363d] bg-[#111827]/90">
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-slate-100">
              <Github className="h-5 w-5" />
              {data.repoFullName}
            </CardTitle>
            <CardDescription>
              Connected to Notion database <span className="font-mono text-xs">{data.notionDatabaseId}</span>
            </CardDescription>
          </div>
          <Badge variant="secondary">1 repo plan</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <SyncStatus
          status={data.status}
          lastSyncedAt={data.lastSyncedAt}
          latencyMs={data.latencyMs}
          lastError={data.lastError}
        />
        <div className="rounded-lg border border-[#30363d] bg-[#0d1117] p-3 text-xs text-slate-300">
          <p className="font-semibold text-slate-200">GitHub webhook URL</p>
          <p className="mt-1 break-all font-mono">{webhookUrl || "Open dashboard in browser to copy"}</p>
        </div>
        <p className="text-xs text-slate-400">Updated {new Date(data.updatedAt).toLocaleString()}</p>
      </CardContent>
      <CardFooter className="flex flex-wrap gap-2">
        <Button onClick={() => onManualSync(data.id)} disabled={syncing}>
          <RefreshCw className={`h-4 w-4 ${syncing ? "animate-spin" : ""}`} />
          Run backfill sync
        </Button>
        <Button
          variant="outline"
          onClick={() => window.open(`https://www.notion.so/${data.notionDatabaseId.replace(/-/g, "")}`, "_blank")}
        >
          <NotepadText className="h-4 w-4" />
          Open Notion
        </Button>
      </CardFooter>
    </Card>
  );
}
