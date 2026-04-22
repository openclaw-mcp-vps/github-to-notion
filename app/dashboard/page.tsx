import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { DashboardClient } from "@/app/dashboard/dashboard-client";
import { PAYWALL_COOKIE_NAME, hasPaidAccess } from "@/lib/paywall";

export default async function DashboardPage() {
  const cookieStore = await cookies();
  const paidToken = cookieStore.get(PAYWALL_COOKIE_NAME)?.value;

  if (!hasPaidAccess(paidToken)) {
    redirect("/checkout/success");
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold">Dashboard</h1>
          <p className="text-sm text-slate-400">Monitor and control your GitHub ↔ Notion sync.</p>
        </div>
        <div className="flex items-center gap-4 text-sm">
          <Link href="/setup" className="text-slate-300 underline underline-offset-4">
            Edit setup
          </Link>
          <a
            href={process.env.NEXT_PUBLIC_STRIPE_PAYMENT_LINK}
            className="text-green-300 underline underline-offset-4"
            target="_blank"
            rel="noreferrer"
          >
            Manage billing
          </a>
        </div>
      </div>
      <DashboardClient />
    </main>
  );
}
