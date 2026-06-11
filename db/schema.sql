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

create index if not exists idx_messages_conversation on messages(conversation_id, created_at);
create index if not exists idx_events_created on events(created_at desc);
create index if not exists idx_leads_created on leads(created_at desc);
create index if not exists idx_leads_status on leads(qualification_status);
create index if not exists idx_conversations_status on conversations(status);
create index if not exists idx_bookings_lead on bookings(lead_id);
