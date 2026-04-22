import { Clock3, Timer, TriangleAlert } from "lucide-react";

import { Badge } from "@/components/ui/badge";

export type SyncStatusProps = {
  status: string;
  lastSyncedAt?: string | null;
  latencyMs?: number | null;
  lastError?: string | null;
};

function statusVariant(status: string) {
  switch (status) {
    case "healthy":
    case "idle":
      return "default" as const;
    case "syncing":
      return "secondary" as const;
    case "error":
      return "destructive" as const;
    default:
      return "outline" as const;
  }
}

export function SyncStatus({ status, lastSyncedAt, latencyMs, lastError }: SyncStatusProps) {
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={statusVariant(status)}>{status}</Badge>
        {lastSyncedAt ? (
          <Badge variant="outline" className="text-slate-300">
            <Clock3 className="mr-1 h-3 w-3" />
            Last sync {new Date(lastSyncedAt).toLocaleTimeString()}
          </Badge>
        ) : null}
        {typeof latencyMs === "number" ? (
          <Badge variant="outline" className="text-slate-300">
            <Timer className="mr-1 h-3 w-3" />
            {latencyMs}ms
          </Badge>
        ) : null}
      </div>
      {lastError ? (
        <p className="flex items-start gap-2 text-sm text-red-300">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
          {lastError}
        </p>
      ) : null}
    </div>
  );
}
