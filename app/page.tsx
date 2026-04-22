import Link from "next/link";
import { ArrowRight, CheckCircle2, Clock3, GitPullRequest, MessageSquareMore, Zap } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { hasPaidAccess, PAYWALL_COOKIE_NAME } from "@/lib/paywall";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";

const faq = [
  {
    q: "How fast is sync in real usage?",
    a: "Webhook events are processed immediately and updates usually appear in under 3 seconds. The dashboard shows measured latency so you can verify your own repo performance."
  },
  {
    q: "Can I use this with private repositories?",
    a: "Yes. Use a GitHub token or OAuth app with repository permissions. For private repos, ensure the token includes `repo` scope."
  },
  {
    q: "How does conflict resolution work?",
    a: "Every record tracks last GitHub and Notion update timestamps. Newer updates win, with a small 2-second tie window to prevent ping-pong loops from near-simultaneous edits."
  },
  {
    q: "What do I need in Notion?",
    a: "One database with a title field. Optional fields like Status, GitHub Number, and GitHub URL improve fidelity, but the app adapts to your existing schema."
  }
];

export default async function LandingPage() {
  const cookieStore = await cookies();
  const paid = hasPaidAccess(cookieStore.get(PAYWALL_COOKIE_NAME)?.value);
  const paymentLink = process.env.NEXT_PUBLIC_STRIPE_PAYMENT_LINK;

  return (
    <main className="relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_15%_0%,rgba(47,129,247,0.22),transparent_35%),radial-gradient(circle_at_85%_15%,rgba(35,134,54,0.16),transparent_40%)]" />

      <section className="relative mx-auto max-w-6xl px-4 pb-20 pt-10 sm:px-6 lg:px-8">
        <header className="mb-14 flex items-center justify-between">
          <p className="text-sm font-semibold tracking-wide text-[#58a6ff]">github-to-notion</p>
          <div className="flex items-center gap-2">
            <Link href={paid ? "/dashboard" : "/access"}>
              <Button variant="outline" size="sm">
                {paid ? "Dashboard" : "Claim Access"}
              </Button>
            </Link>
            {paymentLink ? (
              <a href={paymentLink}>
                <Button size="sm">Buy $12/mo</Button>
              </a>
            ) : null}
          </div>
        </header>

        <div className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr] lg:items-center">
          <div>
            <p className="inline-flex items-center gap-1 rounded-full border border-[#2f81f7]/40 bg-[#2f81f7]/10 px-3 py-1 text-xs font-medium text-[#79c0ff]">
              <Zap className="size-3.5" />
              Real-time bidirectional sync for a single repo setup
            </p>
            <h1 className="mt-5 text-4xl font-semibold leading-tight tracking-tight text-foreground sm:text-5xl">
              GitHub to Notion
              <span className="block text-[#7ee787]">real-time issue + PR sync with zero config</span>
            </h1>
            <p className="mt-5 max-w-2xl text-base text-muted-foreground sm:text-lg">
              Connect one GitHub repository and one Notion database. Every issue, pull request, and
              comment syncs both directions in under 3 seconds with clear status badges and conflict
              safety built in.
            </p>

            <div className="mt-7 flex flex-wrap gap-3">
              {paymentLink ? (
                <a href={paymentLink}>
                  <Button className="h-10 px-5 text-sm">Start for $12 per repo / month</Button>
                </a>
              ) : (
                <Button className="h-10 px-5 text-sm" disabled>
                  Add NEXT_PUBLIC_STRIPE_PAYMENT_LINK to enable checkout
                </Button>
              )}

              <Link href={paid ? "/dashboard" : "/access"}>
                <Button variant="outline" className="h-10 px-5 text-sm">
                  {paid ? "Open Dashboard" : "I Already Paid"}
                  <ArrowRight className="ml-1 size-4" />
                </Button>
              </Link>
            </div>

            <div className="mt-7 grid gap-3 text-sm text-muted-foreground sm:grid-cols-3">
              <p className="flex items-center gap-2">
                <Clock3 className="size-4 text-[#58a6ff]" />
                <span>Under 3s typical webhook latency</span>
              </p>
              <p className="flex items-center gap-2">
                <GitPullRequest className="size-4 text-[#58a6ff]" />
                <span>Issue + PR status parity</span>
              </p>
              <p className="flex items-center gap-2">
                <MessageSquareMore className="size-4 text-[#58a6ff]" />
                <span>Comment sync both ways</span>
              </p>
            </div>
          </div>

          <Card className="border border-border/70 bg-card/80">
            <CardHeader>
              <CardTitle className="text-lg">Why teams switch from Unito</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <p className="flex gap-2">
                <CheckCircle2 className="mt-0.5 size-4 text-[#7ee787]" />
                Built for founders: one repo starter tier without enterprise overhead.
              </p>
              <p className="flex gap-2">
                <CheckCircle2 className="mt-0.5 size-4 text-[#7ee787]" />
                Webhook-driven sync avoids polling lag and keeps board + backlog aligned.
              </p>
              <p className="flex gap-2">
                <CheckCircle2 className="mt-0.5 size-4 text-[#7ee787]" />
                Transparent event log with timestamps and outcome badges for every action.
              </p>
              <p className="flex gap-2">
                <CheckCircle2 className="mt-0.5 size-4 text-[#7ee787]" />
                Predictable pricing at $12/mo per repository.
              </p>
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="relative border-y border-border/70 bg-card/30">
        <div className="mx-auto grid max-w-6xl gap-6 px-4 py-14 sm:px-6 lg:grid-cols-3 lg:px-8">
          <Card className="border border-border/60 bg-card/70">
            <CardHeader>
              <CardTitle className="text-base">The Problem</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              Existing integrations are priced for larger teams and often sync slowly. Solo builders
              need a tight GitHub + Notion loop without spending $29+ each month.
            </CardContent>
          </Card>

          <Card className="border border-border/60 bg-card/70">
            <CardHeader>
              <CardTitle className="text-base">The Solution</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              This app maps one GitHub repo to one Notion database and keeps issues, PRs, and comments
              synchronized in both directions with timestamp-based conflict resolution.
            </CardContent>
          </Card>

          <Card className="border border-border/60 bg-card/70">
            <CardHeader>
              <CardTitle className="text-base">The Offer</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              One SKU: $12 per repo per month. Perfect for indie founders and 2-3 person teams that
              need reliability more than enterprise complexity.
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="relative mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:px-8">
        <h2 className="text-2xl font-semibold tracking-tight text-foreground">Pricing</h2>
        <div className="mt-5 max-w-xl rounded-2xl border border-[#2f81f7]/40 bg-[#0f1a2a]/70 p-6">
          <p className="text-sm uppercase tracking-wide text-[#79c0ff]">Starter</p>
          <p className="mt-2 text-4xl font-semibold text-foreground">$12<span className="text-base text-muted-foreground">/repo/mo</span></p>
          <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
            <li>One GitHub repo + one Notion database</li>
            <li>Bidirectional issue, PR, and comment sync</li>
            <li>Webhook-first, near real-time processing</li>
            <li>Dashboard with status badges + event history</li>
          </ul>
          <div className="mt-6">
            {paymentLink ? (
              <a href={paymentLink}>
                <Button>Buy Starter Plan</Button>
              </a>
            ) : (
              <Button disabled>Add Stripe payment link to enable checkout</Button>
            )}
          </div>
        </div>
      </section>

      <section className="relative mx-auto max-w-6xl px-4 pb-20 sm:px-6 lg:px-8">
        <h2 className="text-2xl font-semibold tracking-tight text-foreground">FAQ</h2>
        <div className="mt-6 grid gap-4">
          {faq.map((item) => (
            <Card key={item.q} className="border border-border/60 bg-card/70">
              <CardHeader>
                <CardTitle className="text-base">{item.q}</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">{item.a}</CardContent>
            </Card>
          ))}
        </div>
      </section>
    </main>
  );
}
