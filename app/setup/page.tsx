import Link from "next/link";

import { SetupPanel } from "@/components/SetupPanel";
import { Button } from "@/components/ui/button";
import { requirePaidAccess } from "@/lib/paid-access";

export const dynamic = "force-dynamic";

export default async function SetupPage() {
  await requirePaidAccess();

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">Setup Sync</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Configure one GitHub repository and one Notion database. Once both webhooks are active,
            issue, PR, and comment updates sync bidirectionally in near real time.
          </p>
        </div>
        <Link href="/dashboard">
          <Button variant="outline">Open Dashboard</Button>
        </Link>
      </div>

      <SetupPanel />
    </main>
  );
}
