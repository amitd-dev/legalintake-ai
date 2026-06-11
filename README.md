# LegalIntake AI

Real-time AI agent platform for law firms. An intake agent answers prospective-client inquiries 24/7 via web chat, qualifies the case, books a real Google Calendar consultation, and logs everything to Postgres. A live operations dashboard (`/dashboard`) shows leads, conversations, bookings, and pipeline value from real database rows — no simulated data.

## Stack

Next.js 14 (App Router, TypeScript) · Tailwind · Anthropic Claude (tool calling) · DigitalOcean Managed Postgres · Google Calendar API (service account) · Vercel

## Setup

### 1. Database (DigitalOcean Managed Postgres)

1. DO control panel → Databases → Create → PostgreSQL (smallest plan is fine).
2. Copy the connection string (Connection Details → Connection string, `sslmode=require`).
3. Set it as `DATABASE_URL` in `.env.local`, then apply the schema:

```bash
npm run db:migrate
```

(Or after deploy: `POST https://your-app/api/admin/migrate?token=MIGRATE_TOKEN` — Phase 2+.)

### 2. Google Calendar (service account)

1. Google Cloud console → create/select a project → enable **Google Calendar API**.
2. IAM & Admin → Service Accounts → Create service account → Keys → Add key (JSON).
3. In Google Calendar, share the target calendar with the service account's `client_email`, permission **Make changes to events**.
4. Set `GOOGLE_SERVICE_ACCOUNT_JSON` (the JSON, single line) and `GOOGLE_CALENDAR_ID` in env.

### 3. Environment variables

Copy `.env.example` → `.env.local` and fill in. On Vercel: Project → Settings → Environment Variables (mark secrets as Sensitive).

### 4. Run locally

```bash
npm install
npm run dev   # http://localhost:3000 (chat) · /dashboard (ops)
```

### 5. Deploy

Push to GitHub → vercel.com → Add New Project → import the repo → set env vars → Deploy. Pushes to `main` auto-deploy.

## Architecture notes

- The Anthropic key is used only inside API routes (server-side). The browser never sees it.
- Every agent tool call (`save_lead`, `check_availability`, `book_consultation`, `escalate`) writes an `events` row; the dashboard polls a single aggregate endpoint (~2s) so all numbers come from the database.
- Realtime: DO Postgres has no websocket push layer (unlike Supabase), so the dashboard uses short-interval polling of indexed queries — same real data, serverless-safe.
- The agent never gives legal advice; distress/urgency/uncertainty triggers the `escalate` tool, which flags the conversation and notifies a human (email in Phase 5).

## Phase status

- [x] Phase 1 — foundation: scaffold, schema, `/api/chat` with intake prompt, chat UI
- [ ] Phase 2 — tool calling + persistence (leads, conversations, messages, events)
- [ ] Phase 3 — Google Calendar availability + real bookings
- [ ] Phase 4 — live ops dashboard
- [ ] Phase 5 — hardening, rate limiting, escalation email, production deploy
- [ ] Phase 6 — stubs only: Twilio voice/SMS, Stripe, e-signature
