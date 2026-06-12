# LegalIntake AI

Real-time AI agent platform for law firms. The flagship **Intake Agent** answers prospective-client inquiries 24/7 via web chat, qualifies the case, books a consultation, and logs everything to Postgres. A live **Operations Dashboard** (`/dashboard`) shows leads, conversations, bookings, and pipeline value — every number from the database, nothing simulated.

**Live:** chat at `/`, ops view at `/dashboard`.

## Stack

Next.js 14 (App Router, TypeScript) · Tailwind · Anthropic Claude (`claude-sonnet-4-6`, tool calling) · DigitalOcean Managed Postgres · Google Calendar API (service account, optional) · Resend (escalation email, optional) · Vercel

## How it works

The agent runs server-side in `/api/chat` with four tools, each of which writes an `events` row the dashboard picks up within ~2s:

| Tool | Effect |
| --- | --- |
| `save_lead` | Insert/update `leads` row, qualification status, estimated value |
| `check_availability` | Real Google free/busy slots — or internal business-hours scheduler when Google isn't configured |
| `book_consultation` | Calendar event (Google mode), `bookings` row, lead → `booked` |
| `escalate` | Flags conversation, logs event, emails a partner via Resend (if configured) |

Guardrails: never gives legal advice; collects contact info before booking; escalates on distress, arrests, court dates, or explicit request for a human. Per-IP rate limiting on the chat API. Tool actions are surfaced to the client as inline chips ("✓ Consultation booked") and to the firm on the dashboard.

## Setup

1. **Database** — DigitalOcean → Databases → PostgreSQL. Set `DATABASE_URL`, then apply the schema: `npm run db:migrate` (or `POST /api/admin/migrate?token=MIGRATE_TOKEN` once deployed).
2. **Anthropic** — set `ANTHROPIC_API_KEY`.
3. **Google Calendar (optional)** — Cloud console → enable Calendar API → service account → JSON key → share the firm calendar with the service-account email ("Make changes to events"). Set `GOOGLE_SERVICE_ACCOUNT_JSON` + `GOOGLE_CALENDAR_ID`. Without these, the internal scheduler is used (bookings are still real DB records).
4. **Escalation email (optional)** — set `RESEND_API_KEY` + `ESCALATION_EMAIL`.
5. **Run** — `npm install && npm run dev` → localhost:3000. **Deploy** — push to GitHub, import in Vercel, set env vars (mark secrets Sensitive). Pushes to `main` auto-deploy.

All env vars are documented in `.env.example`. Firm name, practice areas, and attorneys are configurable (`FIRM_NAME`, `FIRM_PRACTICE_AREAS`, `FIRM_ATTORNEYS`).

## Phase status

- [x] Phase 1 — foundation (scaffold, schema, chat agent, chat UI)
- [x] Phase 2 — tool calling + full persistence (leads, conversations, messages, events)
- [x] Phase 3 — calendar booking (Google-ready; internal scheduler active by default)
- [x] Phase 4 — live ops dashboard (~2s polling of indexed aggregates)
- [x] Phase 5 — rate limiting, escalation email, inline action chips, stubs, docs
- [ ] Phase 6 — stubs only: `src/lib/stubs/` (Twilio voice/SMS, Stripe, e-signature)
- [ ] Phases 7–11 — future agents (drafting, research, discovery, billing, deadlines); table designs documented in `db/schema.sql`, all plug into the shared `events` stream

## Notes & deviations

- Database is DO Managed Postgres (owner's choice) instead of Supabase; dashboard realtime is short-interval polling instead of Supabase Realtime — same real data, serverless-safe.
- The Anthropic key never reaches the client; all AI calls are server-side.
- Rotate the database password from the DO console if it has ever been shared, and update `DATABASE_URL` in Vercel.
