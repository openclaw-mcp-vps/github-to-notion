# GitHub to Notion

Real-time, bidirectional sync for one GitHub repository and one Notion database.

## What It Does

- Syncs GitHub issues + pull requests into Notion in near real time through webhooks.
- Syncs Notion page edits back to GitHub with timestamp-based conflict resolution.
- Syncs comments in both directions where mappings already exist.
- Tracks every sync event with status badges and latency in the dashboard.
- Gates setup and dashboard behind a payment-verified access cookie.

## Local Development

1. Copy envs:
   - `cp .env.example .env.local`
2. Install and run:
   - `npm install`
   - `npm run dev`
3. Open:
   - `http://localhost:3000`

## Webhooks

- GitHub webhook endpoint: `/api/webhooks/github`
- Notion webhook endpoint: `/api/webhooks/notion`
- Stripe webhook endpoint: `/api/stripe/webhook`

Use matching webhook secrets in provider settings and in the app setup screen.

## Paywall Flow

1. User buys through `NEXT_PUBLIC_STRIPE_PAYMENT_LINK`.
2. Stripe sends `checkout.session.completed` to `/api/stripe/webhook`.
3. User visits `/access`, submits billing email, app sets secure access cookie.
4. `/setup` and `/dashboard` become available.

## Health Check

- `GET /api/health` returns `{"status":"ok"}`
