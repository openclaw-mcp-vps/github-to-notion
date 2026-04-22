import Link from "next/link";
import { ArrowRight, CheckCircle2, Clock3, GitPullRequestArrow, NotepadText, ShieldCheck } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const faqs = [
  {
    q: "How fast is sync in real workflows?",
    a: "GitHub and Notion webhooks trigger immediate processing, and most updates are mirrored in 1-3 seconds. Dashboard latency badges show your current pipeline time." 
  },
  {
    q: "What do I need to configure?",
    a: "One GitHub personal access token, one Notion integration token, your repo name, your Notion database ID, and webhook secrets. Setup takes around five minutes." 
  },
  {
    q: "Can I use this for private repositories?",
    a: "Yes. The GitHub token is scoped to your selected repository, and sync state is stored in Postgres under your deployment." 
  },
  {
    q: "Does this replace enterprise workflow automation tools?",
    a: "No. This is purpose-built for solo builders and tiny teams who need one repo synced fast without paying for enterprise seats." 
  }
];

export default function HomePage() {
  return (
    <main className="min-h-screen bg-[#0d1117]">
      <section className="mx-auto max-w-6xl px-4 pb-24 pt-8 sm:px-6 lg:px-8">
        <header className="flex items-center justify-between border-b border-[#30363d] pb-6">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-green-300">github-to-notion</p>
            <h1 className="text-lg font-semibold text-slate-100">Real-time repo sync starter</h1>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" asChild>
              <a href="#pricing">Pricing</a>
            </Button>
            <Button asChild>
              <a href={process.env.NEXT_PUBLIC_STRIPE_PAYMENT_LINK} target="_blank" rel="noreferrer">
                Buy access
              </a>
            </Button>
          </div>
        </header>

        <div className="mt-16 grid gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
          <div>
            <Badge className="mb-4">$12/mo per repo</Badge>
            <h2 className="text-4xl font-semibold leading-tight text-slate-100 sm:text-5xl">
              GitHub to Notion.
              <br />
              Sync every issue, PR, and comment in under 3 seconds.
            </h2>
            <p className="mt-5 max-w-2xl text-lg text-slate-300">
              Stop paying enterprise pricing for basic workflow sync. Connect one GitHub repository and one Notion
              database, then ship from one source of truth with real-time status badges.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button size="lg" asChild>
                <a href={process.env.NEXT_PUBLIC_STRIPE_PAYMENT_LINK} target="_blank" rel="noreferrer">
                  Buy for $12/mo
                  <ArrowRight className="h-4 w-4" />
                </a>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <Link href="/checkout/success">I already purchased</Link>
              </Button>
            </div>
            <div className="mt-8 grid gap-4 sm:grid-cols-2">
              <div className="rounded-lg border border-[#30363d] bg-[#111827]/70 p-4">
                <p className="text-sm text-slate-400">Best for</p>
                <p className="text-base font-semibold text-slate-100">Solo founders and 2-3 person teams</p>
              </div>
              <div className="rounded-lg border border-[#30363d] bg-[#111827]/70 p-4">
                <p className="text-sm text-slate-400">Alternative cost</p>
                <p className="text-base font-semibold text-slate-100">Save vs $29+/mo sync suites</p>
              </div>
            </div>
          </div>

          <Card className="border-[#30363d] bg-[#111827]/90">
            <CardHeader>
              <CardTitle className="text-slate-100">What ships out of the box</CardTitle>
              <CardDescription>No complex setup wizard, no fragile polling jobs.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-sm text-slate-200">
              <p className="flex items-start gap-3">
                <Clock3 className="mt-0.5 h-4 w-4 text-green-300" />
                Webhook-first processing path with PostgreSQL-backed sync state and replay-friendly event logs.
              </p>
              <p className="flex items-start gap-3">
                <GitPullRequestArrow className="mt-0.5 h-4 w-4 text-green-300" />
                Two-way issue and pull request updates plus comment mirroring with source markers.
              </p>
              <p className="flex items-start gap-3">
                <NotepadText className="mt-0.5 h-4 w-4 text-green-300" />
                Notion database schema bootstrapping so your status, IDs, links, and timestamps stay consistent.
              </p>
              <p className="flex items-start gap-3">
                <ShieldCheck className="mt-0.5 h-4 w-4 text-green-300" />
                Paywall cookie gating, Stripe webhook verification, and isolated single-repo configuration.
              </p>
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="border-y border-[#30363d] bg-[#111827]/70 py-16">
        <div className="mx-auto grid max-w-6xl gap-6 px-4 sm:px-6 lg:grid-cols-3 lg:px-8">
          <Card className="bg-[#0d1117]">
            <CardHeader>
              <CardTitle className="text-lg">Problem</CardTitle>
            </CardHeader>
            <CardContent className="text-slate-300">
              Generic integrators add queue latency and force you into expensive multi-repo plans before you need
              them.
            </CardContent>
          </Card>
          <Card className="bg-[#0d1117]">
            <CardHeader>
              <CardTitle className="text-lg">Solution</CardTitle>
            </CardHeader>
            <CardContent className="text-slate-300">
              Purpose-built one-repo sync pipeline optimized for GitHub + Notion collaboration with a lightweight
              dashboard.
            </CardContent>
          </Card>
          <Card className="bg-[#0d1117]">
            <CardHeader>
              <CardTitle className="text-lg">Outcome</CardTitle>
            </CardHeader>
            <CardContent className="text-slate-300">
              Keep product context aligned where you write specs and where you ship code, without paying enterprise
              overhead.
            </CardContent>
          </Card>
        </div>
      </section>

      <section id="pricing" className="mx-auto max-w-4xl px-4 py-20 sm:px-6 lg:px-8">
        <h3 className="text-center text-3xl font-semibold text-slate-100">Simple pricing for a focused workflow</h3>
        <Card className="mx-auto mt-8 max-w-xl border-green-500/40 bg-[#111827]">
          <CardHeader>
            <CardTitle className="text-2xl">Starter Sync</CardTitle>
            <CardDescription>One GitHub repo + one Notion database</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-4xl font-semibold text-slate-100">$12<span className="text-xl text-slate-400">/month</span></p>
            <ul className="mt-6 space-y-3 text-sm text-slate-200">
              <li className="flex items-start gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 text-green-300" />Real-time issue + PR + comment sync</li>
              <li className="flex items-start gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 text-green-300" />Webhook endpoints for both platforms</li>
              <li className="flex items-start gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 text-green-300" />Dashboard with sync health and event history</li>
              <li className="flex items-start gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 text-green-300" />Manual backfill sync for fast onboarding</li>
            </ul>
            <Button className="mt-8 w-full" size="lg" asChild>
              <a href={process.env.NEXT_PUBLIC_STRIPE_PAYMENT_LINK} target="_blank" rel="noreferrer">
                Continue to Stripe Checkout
              </a>
            </Button>
          </CardContent>
        </Card>
      </section>

      <section className="mx-auto max-w-4xl px-4 pb-24 sm:px-6 lg:px-8">
        <h3 className="text-3xl font-semibold text-slate-100">FAQ</h3>
        <div className="mt-6 space-y-4">
          {faqs.map((item) => (
            <Card key={item.q} className="bg-[#111827]/80">
              <CardHeader>
                <CardTitle className="text-lg">{item.q}</CardTitle>
              </CardHeader>
              <CardContent className="text-slate-300">{item.a}</CardContent>
            </Card>
          ))}
        </div>
      </section>
    </main>
  );
}
