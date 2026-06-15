// GET /api/dashboard — single aggregate read the ops dashboard polls (~2s).
// Every number comes from the database; nothing is simulated.
import { NextResponse } from "next/server";
import { query, dbConfigured } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  if (!dbConfigured()) {
    return NextResponse.json({ error: "database not configured" }, { status: 503 });
  }
  try {
    const [kpis, funnel, events, conversations, hourly, agents, yesterday, system] = await Promise.all([
      query<{ leads_today: string; qualified_today: string; booked_today: string; pipeline_value: string }>(`
        select
          count(*) filter (where created_at >= date_trunc('day', now()))                                     as leads_today,
          count(*) filter (where qualification_status in ('qualified','booked')
                             and created_at >= date_trunc('day', now()))                                     as qualified_today,
          count(*) filter (where qualification_status = 'booked'
                             and created_at >= date_trunc('day', now()))                                     as booked_today,
          coalesce(sum(estimated_value) filter (where qualification_status in ('qualified','booked')), 0)    as pipeline_value
        from leads
      `),
      query<{ inquiries: string; qualified: string; booked: string; showed: string }>(`
        select
          (select count(*) from leads)                                                          as inquiries,
          (select count(*) from leads where qualification_status in ('qualified','booked'))     as qualified,
          (select count(*) from bookings where status in ('confirmed','completed'))             as booked,
          (select count(*) from bookings where status = 'completed')                            as showed
      `),
      query(`select id, type, payload, created_at from events order by created_at desc limit 50`),
      query(`
        select c.id, c.started_at, c.status, c.escalated, l.name as lead_name, l.case_type,
               (select count(*) from messages m where m.conversation_id = c.id) as message_count
        from conversations c left join leads l on l.id = c.lead_id
        order by c.started_at desc limit 10
      `),
      // real leads-per-hour series for the last 12 hours (sparkline)
      query<{ bucket: string; n: string }>(`
        select to_char(h, 'YYYY-MM-DD"T"HH24:00') as bucket, coalesce(count(l.id), 0)::text as n
        from generate_series(date_trunc('hour', now()) - interval '11 hours', date_trunc('hour', now()), interval '1 hour') h
        left join leads l on date_trunc('hour', l.created_at) = h
        group by h order by h
      `),
      // per-agent proof of work, straight from the event log
      query<Record<string, string | null>>(`
        select
          count(*) filter (where type in ('conversation_started','lead_captured','lead_qualified','lead_unqualified','booking_created','escalation')
                             and created_at >= date_trunc('day', now()))            as intake_today,
          count(*) filter (where type in ('conversation_started','lead_captured','lead_qualified','lead_unqualified','booking_created','escalation')) as intake_total,
          max(created_at) filter (where type in ('conversation_started','lead_captured','lead_qualified','lead_unqualified','booking_created','escalation')) as intake_last,
          count(*) filter (where type = 'note_recorded' and created_at >= date_trunc('day', now())) as notetaker_today,
          count(*) filter (where type = 'note_recorded')                            as notetaker_total,
          max(created_at) filter (where type = 'note_recorded')                     as notetaker_last,
          count(*) filter (where type = 'document_generated' and coalesce(payload->>'agent','paralegal') = 'paralegal'
                             and created_at >= date_trunc('day', now()))            as paralegal_today,
          count(*) filter (where type = 'document_generated' and coalesce(payload->>'agent','paralegal') = 'paralegal') as paralegal_total,
          max(created_at) filter (where type = 'document_generated' and coalesce(payload->>'agent','paralegal') = 'paralegal') as paralegal_last,
          count(*) filter (where type = 'document_generated' and payload->>'agent' = 'drafting'
                             and created_at >= date_trunc('day', now()))            as drafting_today,
          count(*) filter (where type = 'document_generated' and payload->>'agent' = 'drafting') as drafting_total,
          max(created_at) filter (where type = 'document_generated' and payload->>'agent' = 'drafting') as drafting_last,
          count(*) filter (where type = 'research_memo' and created_at >= date_trunc('day', now())) as research_today,
          count(*) filter (where type = 'research_memo')                            as research_total,
          max(created_at) filter (where type = 'research_memo')                     as research_last,
          count(*) filter (where type = 'campaign_created' and created_at >= date_trunc('day', now())) as marketing_today,
          count(*) filter (where type = 'campaign_created')                         as marketing_total,
          max(created_at) filter (where type = 'campaign_created')                  as marketing_last,
          count(*) filter (where type = 'invoice_drafted' and created_at >= date_trunc('day', now())) as billing_today,
          count(*) filter (where type = 'invoice_drafted')                          as billing_total,
          max(created_at) filter (where type = 'invoice_drafted')                   as billing_last,
          count(*) filter (where type = 'deadline_tracked' and created_at >= date_trunc('day', now())) as deadline_today,
          count(*) filter (where type = 'deadline_tracked')                         as deadline_total,
          max(created_at) filter (where type = 'deadline_tracked')                  as deadline_last,
          count(*) filter (where type = 'discovery_reviewed' and created_at >= date_trunc('day', now())) as discovery_today,
          count(*) filter (where type = 'discovery_reviewed')                       as discovery_total,
          max(created_at) filter (where type = 'discovery_reviewed')                as discovery_last
        from events
      `),
      // yesterday's counts for honest day-over-day deltas
      query<{ leads_y: string; qualified_y: string; booked_y: string }>(`
        select
          count(*) filter (where created_at >= date_trunc('day', now()) - interval '1 day'
                             and created_at < date_trunc('day', now()))             as leads_y,
          count(*) filter (where qualification_status in ('qualified','booked')
                             and created_at >= date_trunc('day', now()) - interval '1 day'
                             and created_at < date_trunc('day', now()))             as qualified_y,
          count(*) filter (where qualification_status = 'booked'
                             and created_at >= date_trunc('day', now()) - interval '1 day'
                             and created_at < date_trunc('day', now()))             as booked_y
        from leads
      `),
      // live system stats: real table count + today's agent faults
      query<{ tables: string; faults: string }>(`
        select
          (select count(*) from information_schema.tables where table_schema = 'public')                 as tables,
          (select count(*) from events where type = 'agent_error'
                              and created_at >= date_trunc('day', now()))                                 as faults
      `)
    ]);

    return NextResponse.json({
      kpis: kpis[0],
      funnel: funnel[0],
      events,
      conversations,
      hourly: hourly.map((h) => Number(h.n)),
      agents: agents[0],
      yesterday: yesterday[0],
      system: system[0],
      generated_at: new Date().toISOString()
    });
  } catch (e) {
    console.error("/api/dashboard error", e);
    return NextResponse.json({ error: "query failed" }, { status: 500 });
  }
}
