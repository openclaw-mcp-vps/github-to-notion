import { getIronSession, type IronSession, type SessionOptions } from "iron-session";
import { cookies } from "next/headers";
import { getPaymentSessionBySessionId } from "@/lib/database";

export interface AppSessionData {
  sid?: string;
  paid?: boolean;
}

const password = process.env.SESSION_PASSWORD || "change-this-to-a-secure-32-char-password";

export const sessionOptions: SessionOptions = {
  cookieName: "gtn_session",
  password,
  cookieOptions: {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production"
  }
};

export async function getAppSession(): Promise<IronSession<AppSessionData>> {
  const cookieStore = await cookies();
  const session = await getIronSession<AppSessionData>(cookieStore, sessionOptions);

  if (!session.sid) {
    session.sid = crypto.randomUUID();
    session.paid = false;
    await session.save();
  }

  return session;
}

export async function refreshPaidStatus(session: IronSession<AppSessionData>) {
  if (!session.sid) {
    return false;
  }

  const payment = await getPaymentSessionBySessionId(session.sid);
  const paid = payment?.status === "paid";

  if (paid && !session.paid) {
    session.paid = true;
    await session.save();
  }

  return Boolean(session.paid);
}
