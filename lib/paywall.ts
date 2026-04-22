import { createHmac, timingSafeEqual } from "node:crypto";

import type { PurchaseRecord } from "@/lib/types";
import { boolEnv } from "@/lib/env";

export const PAYWALL_COOKIE_NAME = "gtn_paid_access";
const PAYWALL_TTL_SECONDS = 60 * 60 * 24 * 30;

type AccessPayload = {
  email: string;
  iat: number;
  exp: number;
};

function getCookieSecret(): string {
  return process.env.PAYWALL_COOKIE_SECRET || "local-dev-cookie-secret-change-me";
}

function sign(value: string): string {
  return createHmac("sha256", getCookieSecret()).update(value).digest("hex");
}

function encode(payload: AccessPayload): string {
  const json = JSON.stringify(payload);
  const base = Buffer.from(json, "utf8").toString("base64url");
  const signature = sign(base);
  return `${base}.${signature}`;
}

function decode(token: string): AccessPayload | null {
  const [base, providedSignature] = token.split(".");

  if (!base || !providedSignature) {
    return null;
  }

  const expectedSignature = sign(base);
  const left = Buffer.from(expectedSignature, "utf8");
  const right = Buffer.from(providedSignature, "utf8");

  if (left.length !== right.length || !timingSafeEqual(left, right)) {
    return null;
  }

  try {
    const parsed = JSON.parse(Buffer.from(base, "base64url").toString("utf8")) as AccessPayload;
    const now = Math.floor(Date.now() / 1000);

    if (parsed.exp <= now) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

export function makeAccessToken(email: string): string {
  const now = Math.floor(Date.now() / 1000);
  return encode({
    email: email.toLowerCase(),
    iat: now,
    exp: now + PAYWALL_TTL_SECONDS
  });
}

export function verifyAccessToken(token: string | undefined): AccessPayload | null {
  if (!token) {
    return null;
  }

  return decode(token);
}

export function accessCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    maxAge: PAYWALL_TTL_SECONDS,
    path: "/"
  };
}

export function hasPaidAccess(token: string | undefined): boolean {
  if (boolEnv("PAYWALL_DEV_BYPASS")) {
    return true;
  }

  return Boolean(verifyAccessToken(token));
}

export function hasPurchaseEmail(records: PurchaseRecord[], email: string): boolean {
  const normalized = email.toLowerCase();
  return records.some((record) => record.email.toLowerCase() === normalized);
}
