import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { hasPaidAccess, PAYWALL_COOKIE_NAME } from "@/lib/paywall";

export async function requirePaidAccess(): Promise<void> {
  const cookieStore = await cookies();
  const token = cookieStore.get(PAYWALL_COOKIE_NAME)?.value;

  if (!hasPaidAccess(token)) {
    redirect("/access");
  }
}
