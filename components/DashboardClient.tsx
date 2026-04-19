"use client";

import { useMemo, useState } from "react";
import useSWR from "swr";
import Link from "next/link";
import { CheckCircle2, ShieldCheck, Zap } from "lucide-react";
import { CheckoutCta } from "@/components/CheckoutCta";
import { RepoSetup } from "@/components/RepoSetup";
import { SyncStatus } from "@/components/SyncStatus";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface PaywallStatus {
  paid: boolean;
  sessionId: string;
  configured: boolean;
  repoFullName: string | null;
}

const fetcher = async (url: string) => {
  const response = await fetch(url, { cache: "no-store" });
  const payload = (await response.json()) as PaywallStatus;

  if (!response.ok) {
    throw new Error("Unable to fetch paywall status");
  }

  return payload;
};

export function DashboardClient() {
  const { data, mutate, isLoading, error } = useSWR<PaywallStatus>("/api/paywall/status", fetcher, {
    refreshInterval: 2500,
    revalidateOnFocus: true
  });

  const initialRepo = useMemo(() => data?.repoFullName || "", [data?.repoFullName]);
  const [activeRepo, setActiveRepo] = useState("");
  const repo = activeRepo || initialRepo;

  if (isLoading) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-5xl items-center justify-center px-4 py-16">
        <p className="text-sm text-[#8b949e]">Loading account status...</p>
      </main>
    );
  }

  if (error || !data) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-3xl items-center justify-center px-4 py-16">
        <Card className="w-full">
          <CardHeader>
            <CardTitle>Dashboard unavailable</CardTitle>
            <CardDescription>
              We could not load your session state. Refresh the page or verify your database connection.
            </CardDescription>
          </CardHeader>
        </Card>
      </main>
    );
  }

  if (!data.paid) {
    return (
      <main className="mx-auto min-h-screen w-full max-w-3xl px-4 py-12">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Dashboard</h1>
          <Link className="text-sm text-[#58a6ff] hover:underline" href="/">
            Back to landing page
          </Link>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Activate your one-repo sync workspace</CardTitle>
            <CardDescription>
              Billing is $12/month per repository. After checkout, this dashboard unlocks in seconds.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Badge variant="success" className="gap-1">
                <Zap className="h-3.5 w-3.5" />
                Under 3-second webhook processing
              </Badge>
              <Badge variant="neutral" className="gap-1">
                <ShieldCheck className="h-3.5 w-3.5" />
                No seat-based pricing
              </Badge>
              <Badge variant="warning" className="gap-1">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Single repo + single Notion DB focus
              </Badge>
            </div>

            <CheckoutCta
              buttonText="Start $12/mo checkout"
              onPaid={() => {
                void mutate();
              }}
            />
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-5xl px-4 py-10">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold text-[#f0f6fc]">GitHub to Notion Dashboard</h1>
          <p className="mt-1 text-sm text-[#8b949e]">Live sync workspace for one repository and one Notion database.</p>
        </div>
        <Link className="text-sm text-[#58a6ff] hover:underline" href="/">
          View product page
        </Link>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.2fr,1fr]">
        <RepoSetup
          defaultRepoFullName={initialRepo}
          onConfigured={(repoFullName) => {
            setActiveRepo(repoFullName);
            void mutate();
          }}
        />

        {repo ? (
          <SyncStatus repoFullName={repo} />
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Sync telemetry</CardTitle>
              <CardDescription>Save repository credentials to start showing real-time status badges and event latency.</CardDescription>
            </CardHeader>
          </Card>
        )}
      </div>
    </main>
  );
}
