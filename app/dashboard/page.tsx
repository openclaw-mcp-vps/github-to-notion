import Link from "next/link";

import { SyncStatus } from "@/components/SyncStatus";
import { Button } from "@/components/ui/button";
import { requirePaidAccess } from "@/lib/paid-access";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  await requirePaidAccess();

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">Sync Dashboard</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Monitor webhook health, last sync latency, and recent bidirectional events across GitHub
            and Notion.
          </p>
        </div>
        <Link href="/setup">
          <Button variant="outline">Edit Setup</Button>
        </Link>
      </div>

      <SyncStatus />
    </main>
  );
}
