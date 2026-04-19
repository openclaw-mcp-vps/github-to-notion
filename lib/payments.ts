import crypto from "node:crypto";

interface LemonWebhookPayload {
  meta?: {
    event_name?: string;
    custom_data?: Record<string, unknown>;
  };
  data?: {
    id?: string;
    attributes?: {
      status?: string;
      custom_data?: Record<string, unknown>;
      checkout_data?: {
        custom?: Record<string, unknown>;
      };
      order_id?: number;
    };
  };
}

export function verifyLemonSignature(rawBody: string, signature: string | null) {
  const secret = process.env.LEMON_SQUEEZY_WEBHOOK_SECRET;

  if (!secret) {
    return true;
  }

  if (!signature) {
    return false;
  }

  const digest = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
  const sigBuffer = Buffer.from(signature, "utf8");
  const digestBuffer = Buffer.from(digest, "utf8");

  if (sigBuffer.length !== digestBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(sigBuffer, digestBuffer);
}

export function getCheckoutUrl(sessionId: string, origin: string) {
  const productId = process.env.NEXT_PUBLIC_LEMON_SQUEEZY_PRODUCT_ID;

  if (!productId) {
    throw new Error("NEXT_PUBLIC_LEMON_SQUEEZY_PRODUCT_ID is required");
  }

  const base = productId.startsWith("http") ? productId : `https://checkout.lemonsqueezy.com/buy/${productId}`;
  const url = new URL(base);

  url.searchParams.set("checkout[custom][session_id]", sessionId);
  url.searchParams.set("checkout[custom][source]", "github-to-notion");
  url.searchParams.set("checkout[custom][store_id]", process.env.NEXT_PUBLIC_LEMON_SQUEEZY_STORE_ID || "");
  url.searchParams.set("checkout[embed]", "1");
  url.searchParams.set("checkout[media]", "0");
  url.searchParams.set("checkout[logo]", "0");
  url.searchParams.set("checkout[desc]", "0");
  url.searchParams.set("checkout[success_url]", `${origin}/dashboard?checkout=success`);

  return url.toString();
}

export function parseLemonPayload(payload: LemonWebhookPayload) {
  const eventName = payload.meta?.event_name ?? "unknown";
  const customData = payload.meta?.custom_data || payload.data?.attributes?.custom_data || payload.data?.attributes?.checkout_data?.custom || {};
  const sessionId =
    (typeof customData.session_id === "string" && customData.session_id) ||
    (typeof customData.sessionId === "string" && customData.sessionId) ||
    null;

  const orderId =
    (typeof payload.data?.id === "string" && payload.data.id) ||
    (typeof payload.data?.attributes?.order_id === "number" && String(payload.data.attributes.order_id)) ||
    `${eventName}-${Date.now()}`;

  const paidEvents = new Set(["order_created", "subscription_created", "subscription_payment_success"]);
  const status = paidEvents.has(eventName) ? "paid" : payload.data?.attributes?.status || "pending";

  return {
    eventName,
    sessionId,
    orderId,
    status
  };
}
