-- LegalIntake AI — DigitalOcean Managed Postgres schema
-- Apply via: npm run db:migrate  (or POST /api/admin/migrate?token=MIGRATE_TOKEN once deployed)

create extension if not exists pgcrypto;

create table if not exists leads (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  name text,
  phone text,
  email text,
  case_type text,
  case_summary text,
  urgency text check (urgency in ('low','medium','high')),
  qualification_status text not null default 'new'
    check (qualification_status in ('new','qualified','unqualified','booked')),
  estimated_value numeric(12,2),
  source text not null default 'web'
);

create table if not exists conversations (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references leads(id) on delete set null,
  channel text not null default 'web' check (channel in ('web','phone','sms')),
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  status text not null default 'active' check (status in ('active','ended','escalated')),
  escalated boolean not null default false
);

create table if not exists messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references conversations(id) on delete cascade,
  role text not null check (role in ('user','agent')),
  content text not null,
  created_at timestamptz not null default now()
);

create table if not exists bookings (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references leads(id) on delete cascade,
  calendar_event_id text,
  scheduled_at timestamptz not null,
  attorney_name text not null,
  status text not null default 'confirmed'
    check (status in ('confirmed','no_show','completed','cancelled')),
  created_at timestamptz not null default now()
);

create table if not exists events (
  id uuid primary key default gen_random_uuid(),
  type text not null,
  payload jsonb not null default '{}',
  created_at timestamptz not null default now()
);

-- AI note-taker: consultation transcripts structured into case notes
create table if not exists consultation_notes (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references leads(id) on delete cascade,
  transcript text not null,
  structured jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index if not exists idx_notes_lead on consultation_notes(lead_id, created_at desc);

-- Paralegal agent output: generated documents (e.g. filled USCIS Form G-28)
create table if not exists documents (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references leads(id) on delete cascade,
  type text not null,                -- e.g. 'g-28'
  status text not null default 'draft' check (status in ('draft','reviewed','sent')),
  filename text not null,
  content bytea not null,            -- the filled PDF bytes
  field_data jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index if not exists idx_documents_lead on documents(lead_id, created_at desc);

-- Research Agent: structured legal research memos (AI first-pass, attorney must verify)
create table if not exists research_memos (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references leads(id) on delete set null,
  question text not null,
  jurisdiction text not null,
  memo jsonb not null,
  created_at timestamptz not null default now()
);
create index if not exists idx_memos_created on research_memos(created_at desc);

-- Marketing Agent: AI-drafted campaign concepts + ad copy, grounded in real
-- lead-source conversion data. content jsonb holds the structured campaign
-- (objective, channel_plan, ads[], kpis, disclaimer).
create table if not exists campaigns (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  goal text not null,
  channel text not null default 'auto',
  audience text not null default '',
  content jsonb not null,
  created_at timestamptz not null default now()
);
create index if not exists idx_campaigns_created on campaigns(created_at desc);

-- Billing Agent: itemized time entries drafted from matter activity, compiled
-- into invoices. Stripe payment links are stubbed (lib/stubs/stripe).
create table if not exists time_entries (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references leads(id) on delete set null,
  invoice_id uuid,
  entry_date date not null default current_date,
  narrative text not null,
  hours numeric(6,2) not null default 0,
  rate numeric(10,2) not null default 0,
  amount numeric(12,2) not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists idx_time_entries_lead on time_entries(lead_id, created_at desc);

create table if not exists invoices (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references leads(id) on delete set null,
  invoice_number text not null,
  client_name text not null default '',
  matter text not null default '',
  line_items jsonb not null default '[]',
  subtotal numeric(12,2) not null default 0,
  total numeric(12,2) not null default 0,
  status text not null default 'draft' check (status in ('draft','sent','paid')),
  payment_link text,
  created_at timestamptz not null default now()
);
create index if not exists idx_invoices_created on invoices(created_at desc);

-- Deadline Agent: statute-of-limitations + procedural deadlines with escalating
-- alert levels. A daily Vercel cron (/api/cron/deadlines) re-evaluates alerts.
create table if not exists deadlines (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references leads(id) on delete set null,
  matter text not null default '',
  type text not null,                 -- e.g. 'statute of limitations', 'answer due'
  jurisdiction text not null default '',
  due_date date not null,
  basis text not null default '',     -- the rule/citation the date is computed from
  alert_level text not null default 'normal'
    check (alert_level in ('normal','upcoming','urgent','overdue')),
  status text not null default 'open' check (status in ('open','resolved','dismissed')),
  created_at timestamptz not null default now()
);
create index if not exists idx_deadlines_due on deadlines(due_date);
create index if not exists idx_deadlines_status on deadlines(status);

-- Discovery Agent: document-review batches. result jsonb holds findings
-- (excerpt, issue_tag, relevance), a chronology, and a summary.
create table if not exists discovery_reviews (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references leads(id) on delete set null,
  name text not null,
  doc_count integer not null default 0,
  result jsonb not null,
  created_at timestamptz not null default now()
);
create index if not exists idx_discovery_created on discovery_reviews(created_at desc);

-- ============================================================================
-- FUTURE AGENTS (Phases 9-11) — designed-in, created when each phase begins.
-- Architecture rule: every agent writes to the shared `events` table above,
-- so the dashboard stays the single pane of glass. One database, one event
-- stream, many agents.
--
-- Phase 7  Document Drafting:  documents(id, lead_id, type, status draft/reviewed/sent, content, created_at)
-- Phase 8  Legal Research:     research_memos(id, question, jurisdiction, memo, citations_verified bool, created_at)
-- Phase 9  Discovery/Review:   doc_batches, doc_files, doc_findings(file_id, page, excerpt_reference,
--                              issue_tag, relevance_score), chronologies — plus a background job queue
-- Phase 10 Billing:            time_entries, invoices, payment_reminders (Stripe links)
-- Phase 11 Deadlines:          deadlines(matter_id, type, due_date, alert_schedule, status) + daily cron
-- ============================================================================

create index if not exists idx_messages_conversation on messages(conversation_id, created_at);
create index if not exists idx_events_created on events(created_at desc);
create index if not exists idx_leads_created on leads(created_at desc);
create index if not exists idx_leads_status on leads(qualification_status);
create index if not exists idx_conversations_status on conversations(status);
create index if not exists idx_bookings_lead on bookings(lead_id);
