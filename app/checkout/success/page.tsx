import Link from "next/link";
import { Suspense } from "react";

import { CheckoutSuccessClient } from "@/app/checkout/success/success-client";

export default function CheckoutSuccessPage() {
  return (
    <main className="mx-auto min-h-screen w-full max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold">Stripe purchase verification</h1>
          <p className="text-sm text-slate-400">Unlock access, then connect your repo and Notion database.</p>
        </div>
        <Link href="/" className="text-sm text-slate-300 underline underline-offset-4">
          Back to landing
        </Link>
      </div>
      <Suspense
        fallback={
          <p className="rounded-lg border border-[#30363d] bg-[#111827]/90 p-6 text-sm text-slate-300">
            Loading checkout status...
          </p>
        }
      >
        <CheckoutSuccessClient />
      </Suspense>
    </main>
  );
}
