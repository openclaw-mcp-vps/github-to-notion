import crypto from "node:crypto";

function safeCompare(hexA: string, hexB: string) {
  const a = Buffer.from(hexA, "utf8");
  const b = Buffer.from(hexB, "utf8");
  if (a.length !== b.length) {
    return false;
  }

  return crypto.timingSafeEqual(a, b);
}

export function verifyGitHubSignature(payload: string, signatureHeader: string | null, secret: string) {
  if (!signatureHeader || !signatureHeader.startsWith("sha256=")) {
    return false;
  }

  const digest = crypto.createHmac("sha256", secret).update(payload).digest("hex");
  const provided = signatureHeader.slice("sha256=".length);

  return safeCompare(digest, provided);
}

export function verifyStripeSignature(payload: string, stripeSignature: string | null, secret: string) {
  if (!stripeSignature) {
    return false;
  }

  const parts = stripeSignature
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)
    .reduce<Record<string, string>>((acc, pair) => {
      const [key, value] = pair.split("=");
      if (key && value) {
        acc[key] = value;
      }
      return acc;
    }, {});

  if (!parts.t || !parts.v1) {
    return false;
  }

  const signedPayload = `${parts.t}.${payload}`;
  const expected = crypto.createHmac("sha256", secret).update(signedPayload).digest("hex");

  return safeCompare(expected, parts.v1);
}
