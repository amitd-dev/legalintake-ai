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
    const [kpis, funnel, events, conversations, hourly] = await Promise.all([
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
      query(`select id, type, payload, created_at from events order by created_at desc limit 25`),
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
      `)
    ]);

    return NextResponse.json({
      kpis: kpis[0],
      funnel: funnel[0],
      events,
      conversations,
      hourly: hourly.map((h) => Number(h.n)),
      generated_at: new Date().toISOString()
    });
  } catch (e) {
    console.error("/api/dashboard error", e);
    return NextResponse.json({ error: "query failed" }, { status: 500 });
  }
}
