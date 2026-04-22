import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { SetupForm } from "@/app/setup/setup-form";
import { PAYWALL_COOKIE_NAME, hasPaidAccess } from "@/lib/paywall";

export default async function SetupPage() {
  const cookieStore = await cookies();
  const paidToken = cookieStore.get(PAYWALL_COOKIE_NAME)?.value;

  if (!hasPaidAccess(paidToken)) {
    redirect("/checkout/success");
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold">Setup</h1>
          <p className="text-sm text-slate-400">Connect your repo and Notion database to start syncing.</p>
        </div>
        <Link href="/dashboard" className="text-sm text-green-300 underline underline-offset-4">
          Open dashboard
        </Link>
      </div>
      <SetupForm />
    </main>
  );
}
