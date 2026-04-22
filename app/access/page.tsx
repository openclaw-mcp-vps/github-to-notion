"use client";

import Link from "next/link";
import { useState } from "react";
import { CreditCard, ShieldCheck } from "lucide-react";
import toast from "react-hot-toast";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function AccessPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  const paymentLink = process.env.NEXT_PUBLIC_STRIPE_PAYMENT_LINK;

  const claimAccess = async () => {
    setLoading(true);

    const promise = fetch("/api/paywall/claim", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ email })
    }).then(async (response) => {
      const json = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(json.error || "Access claim failed.");
      }

      return json;
    });

    toast.promise(promise, {
      loading: "Verifying purchase...",
      success: "Access granted. Redirecting to dashboard...",
      error: (message) => String(message)
    });

    try {
      await promise;
      window.location.href = "/dashboard";
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="mx-auto flex min-h-[calc(100vh-2rem)] w-full max-w-2xl items-center px-4 py-10 sm:px-6">
      <Card className="w-full border border-border/60 bg-card/80">
        <CardHeader>
          <CardTitle className="text-2xl">Unlock Your Workspace</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <p className="text-sm text-muted-foreground">
            Access to setup and dashboard is unlocked after Stripe checkout. Use the same billing
            email below to set your secure access cookie.
          </p>

          <div className="space-y-2">
            <Label htmlFor="billing-email">Billing Email</Label>
            <Input
              id="billing-email"
              type="email"
              placeholder="you@company.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            <Button onClick={claimAccess} disabled={loading || !email}>
              <ShieldCheck className="mr-1 size-4" />
              Verify Purchase
            </Button>

            {paymentLink ? (
              <a href={paymentLink} className="inline-flex">
                <Button className="w-full" variant="outline">
                  <CreditCard className="mr-1 size-4" />
                  Buy $12 / repo / month
                </Button>
              </a>
            ) : (
              <Button className="w-full" variant="outline" disabled>
                Stripe payment link not configured
              </Button>
            )}
          </div>

          <p className="text-xs text-muted-foreground">
            Stripe webhooks can take a few seconds. If verification fails immediately after payment,
            wait 5-10 seconds and retry.
          </p>

          <p className="text-xs text-muted-foreground">
            Need setup help? Go to <Link href="/setup" className="text-[#58a6ff] hover:underline">/setup</Link>{" "}
            after access is granted.
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
