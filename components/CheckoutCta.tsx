"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface PaywallStatus {
  paid: boolean;
  sessionId: string;
  configured: boolean;
  repoFullName: string | null;
}

interface CheckoutCtaProps {
  buttonText: string;
  className?: string;
  onPaid?: () => void;
}

declare global {
  interface Window {
    LemonSqueezy?: {
      Url?: {
        Open: (url: string) => void;
      };
      Setup?: (options?: { eventHandler?: (event: unknown) => void }) => void;
    };
  }
}

const fetcher = async (url: string) => {
  const response = await fetch(url, { cache: "no-store" });

  if (!response.ok) {
    throw new Error("Unable to fetch billing status");
  }

  return (await response.json()) as PaywallStatus;
};

function loadLemonScript() {
  if (typeof window === "undefined") {
    return;
  }

  if (document.querySelector("script[data-lemonjs='true']")) {
    return;
  }

  const script = document.createElement("script");
  script.src = "https://app.lemonsqueezy.com/js/lemon.js";
  script.defer = true;
  script.dataset.lemonjs = "true";
  document.head.appendChild(script);
}

export function CheckoutCta({ buttonText, className, onPaid }: CheckoutCtaProps) {
  const router = useRouter();
  const [isOpeningCheckout, setIsOpeningCheckout] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pollForPayment, setPollForPayment] = useState(false);

  const { data, mutate, isLoading } = useSWR<PaywallStatus>("/api/paywall/status", fetcher, {
    refreshInterval: pollForPayment ? 2000 : 0,
    revalidateOnFocus: true
  });

  useEffect(() => {
    loadLemonScript();
  }, []);

  useEffect(() => {
    if (data?.paid) {
      setPollForPayment(false);
      onPaid?.();
    }
  }, [data?.paid, onPaid]);

  async function startCheckout() {
    setError(null);
    setIsOpeningCheckout(true);

    try {
      const response = await fetch("/api/checkout", {
        method: "POST"
      });

      const payload = (await response.json()) as { checkoutUrl?: string; message?: string };

      if (!response.ok || !payload.checkoutUrl) {
        throw new Error(payload.message || "Unable to open checkout.");
      }

      setPollForPayment(true);

      if (window.LemonSqueezy?.Url?.Open) {
        window.LemonSqueezy.Url.Open(payload.checkoutUrl);
      } else {
        window.location.assign(payload.checkoutUrl);
      }

      void mutate();
    } catch (checkoutError) {
      setError(checkoutError instanceof Error ? checkoutError.message : "Checkout failed.");
    } finally {
      setIsOpeningCheckout(false);
    }
  }

  if (data?.paid) {
    return (
      <Button className={className} onClick={() => router.push("/dashboard")}>
        Open Dashboard
      </Button>
    );
  }

  return (
    <div>
      <Button className={className} disabled={isLoading || isOpeningCheckout} onClick={startCheckout}>
        {isOpeningCheckout ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
        {buttonText}
      </Button>
      {error ? <p className="mt-2 text-sm text-[#ff7b72]">{error}</p> : null}
    </div>
  );
}
