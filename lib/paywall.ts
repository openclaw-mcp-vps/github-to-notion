import crypto from "node:crypto";

export const PAYWALL_COOKIE_NAME = "gtn_paid";

const THIRTY_DAYS_SECONDS = 60 * 60 * 24 * 30;

function getPaywallSecret() {
  return process.env.STRIPE_WEBHOOK_SECRET || "dev-paywall-secret";
}

function encode(data: string) {
  return Buffer.from(data, "utf8").toString("base64url");
}

function decode(data: string) {
  return Buffer.from(data, "base64url").toString("utf8");
}

function sign(data: string) {
  return crypto.createHmac("sha256", getPaywallSecret()).update(data).digest("base64url");
}

export function createPaywallToken(params: { sessionId: string; email?: string | null }) {
  const payload = {
    sessionId: params.sessionId,
    email: params.email ?? null,
    exp: Date.now() + THIRTY_DAYS_SECONDS * 1000
  };

  const encoded = encode(JSON.stringify(payload));
  const signature = sign(encoded);

  return `${encoded}.${signature}`;
}

export function hasPaidAccess(token?: string | null) {
  if (!token) {
    return false;
  }

  const [encoded, providedSignature] = token.split(".");
  if (!encoded || !providedSignature) {
    return false;
  }

  const expectedSignature = sign(encoded);
  if (providedSignature !== expectedSignature) {
    return false;
  }

  try {
    const payload = JSON.parse(decode(encoded)) as { exp?: number };
    return typeof payload.exp === "number" && payload.exp > Date.now();
  } catch {
    return false;
  }
}

export function paywallCookieConfig(value: string) {
  return {
    name: PAYWALL_COOKIE_NAME,
    value,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: THIRTY_DAYS_SECONDS
  };
}
