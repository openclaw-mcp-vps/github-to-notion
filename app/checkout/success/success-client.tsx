"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import toast from "react-hot-toast";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function CheckoutSuccessClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [activating, setActivating] = useState(false);

  const activate = async () => {
    const sessionId = searchParams.get("session_id");
    if (!sessionId) {
      toast.error("Missing session_id in URL. Configure your Stripe payment link success URL.");
      return;
    }

    setActivating(true);

    try {
      const response = await fetch(`/api/paywall/activate?session_id=${encodeURIComponent(sessionId)}`, {
        method: "POST"
      });

      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to activate access yet");
      }

      toast.success("Access unlocked. Redirecting to setup...");
      router.push("/setup");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Activation failed");
    } finally {
      setActivating(false);
    }
  };

  useEffect(() => {
    if (searchParams.get("session_id")) {
      void activate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Card className="mx-auto max-w-2xl bg-[#111827]/90">
      <CardHeader>
        <CardTitle>Complete unlock</CardTitle>
        <CardDescription>
          After Stripe checkout, this page validates your paid session and sets a secure access cookie.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-slate-300">
          If you were redirected from Stripe, activation runs automatically. If webhook delivery is delayed, click the
          button once it appears in your Stripe event logs.
        </p>
        <Button onClick={activate} disabled={activating}>
          {activating ? "Activating..." : "Activate paid access"}
        </Button>
      </CardContent>
    </Card>
  );
}
