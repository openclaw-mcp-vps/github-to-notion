import Link from "next/link";
import { ArrowRight, CheckCheck, DollarSign, Github, NotepadTextDashed, Timer } from "lucide-react";
import { CheckoutCta } from "@/components/CheckoutCta";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const faqItems = [
  {
    question: "How fast is syncing in practice?",
    answer:
      "Webhook events are processed immediately and pushed to your connected system with a target of under 3 seconds for issue, PR, and comment updates."
  },
  {
    question: "What exactly is included in $12/month?",
    answer:
      "One GitHub repository, one Notion database, bidirectional issue and PR state sync, and mirrored comments without teammate seat limits."
  },
  {
    question: "Do I need to restructure my Notion workspace?",
    answer:
      "No. You connect one existing Notion database and we map GitHub data to your current properties, then append rich context blocks automatically."
  },
  {
    question: "Can I cancel anytime?",
    answer:
      "Yes. Billing is month-to-month through Lemon Squeezy and can be canceled from your subscription portal any time."
  }
];

export default function LandingPage() {
  return (
    <main className="pb-24">
      <section className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 pt-16 md:pt-24">
        <div className="flex flex-wrap items-center gap-3">
          <Badge variant="success">Real-time issue + PR sync</Badge>
          <Badge variant="neutral">Built for solo founders</Badge>
          <Badge variant="warning">$12/month per repo</Badge>
        </div>

        <div className="grid gap-10 lg:grid-cols-[1.2fr,0.8fr] lg:items-center">
          <div>
            <h1 className="max-w-3xl text-4xl font-semibold leading-tight text-[#f0f6fc] md:text-6xl">
              GitHub to Notion, synced both ways in seconds.
            </h1>
            <p className="mt-5 max-w-2xl text-lg text-[#8b949e]">
              Stop paying enterprise integration pricing for one small workflow. Connect one repo to one Notion database and keep
              issues, pull requests, and comments aligned automatically.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <CheckoutCta buttonText="Start syncing for $12/mo" className="h-12 px-6 text-base" />
              <Link
                className="inline-flex h-12 items-center rounded-lg border border-[#30363d] px-5 text-sm font-semibold text-[#c9d1d9] transition hover:bg-[#161b22]"
                href="/dashboard"
              >
                Open dashboard
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </div>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Why this exists</CardTitle>
              <CardDescription>
                Existing tools are powerful but oversized for tiny teams. You only need one repo synced reliably and quickly.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-[#c9d1d9]">
              <p className="flex items-start gap-2">
                <DollarSign className="mt-0.5 h-4 w-4 text-[#58a6ff]" />
                Competing integrations often start around $29/month before usage grows.
              </p>
              <p className="flex items-start gap-2">
                <Timer className="mt-0.5 h-4 w-4 text-[#58a6ff]" />
                Slow sync lag breaks trust when planning and shipping move quickly.
              </p>
              <p className="flex items-start gap-2">
                <CheckCheck className="mt-0.5 h-4 w-4 text-[#58a6ff]" />
                This product focuses on one job: fast, reliable two-way sync for one codebase.
              </p>
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="mx-auto mt-20 w-full max-w-6xl px-4">
        <div className="grid gap-6 md:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Github className="h-5 w-5 text-[#58a6ff]" />
                GitHub events in
              </CardTitle>
              <CardDescription>
                Receive issue, pull request, and comment webhooks and process updates instantly.
              </CardDescription>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <NotepadTextDashed className="h-5 w-5 text-[#58a6ff]" />
                Notion updates out
              </CardTitle>
              <CardDescription>
                Create or update linked Notion pages, sync statuses, and append comment threads with attribution.
              </CardDescription>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Timer className="h-5 w-5 text-[#58a6ff]" />
                Visible status
              </CardTitle>
              <CardDescription>
                Track latency, event health, and synced item counts from a focused dashboard built for one active repo.
              </CardDescription>
            </CardHeader>
          </Card>
        </div>
      </section>

      <section className="mx-auto mt-20 w-full max-w-4xl px-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-3xl">Simple pricing for indie teams</CardTitle>
            <CardDescription>No seat pricing. No workspace tax. One SKU built for one shipping repository.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-4xl font-semibold text-[#f0f6fc]">
                $12<span className="text-lg text-[#8b949e]">/repo/month</span>
              </p>
              <p className="mt-2 text-sm text-[#8b949e]">Includes bidirectional sync, webhook processing, and live sync telemetry.</p>
            </div>
            <CheckoutCta buttonText="Activate one-repo plan" />
          </CardContent>
        </Card>
      </section>

      <section className="mx-auto mt-20 w-full max-w-4xl px-4">
        <h2 className="text-2xl font-semibold text-[#f0f6fc] md:text-3xl">FAQ</h2>
        <div className="mt-6 space-y-4">
          {faqItems.map((item) => (
            <Card key={item.question}>
              <CardHeader>
                <CardTitle className="text-lg">{item.question}</CardTitle>
                <CardDescription>{item.answer}</CardDescription>
              </CardHeader>
            </Card>
          ))}
        </div>
      </section>
    </main>
  );
}
