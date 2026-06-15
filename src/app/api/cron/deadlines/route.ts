// GET /api/cron/deadlines — daily Vercel cron (see vercel.json).
// Recomputes alert levels for open deadlines and logs an escalation event for any
// that newly became urgent or overdue, so the dashboard/Agent OS surface them.
import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { logEvent } from "@/lib/events";
import { alertLevelFor, daysUntil } from "@/lib/deadlines";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const rows = await query<{ id: string; matter: string; type: string; due_date: string; alert_level: string }>(
      "select id, matter, type, due_date, alert_level from deadlines where status = 'open'"
    );

    let escalated = 0;
    for (const r of rows) {
      const level = alertLevelFor(r.due_date);
      if (level !== r.alert_level) {
        await query("update deadlines set alert_level = $1 where id = $2", [level, r.id]);
      }
      if ((level === "urgent" || level === "overdue") && r.alert_level !== level) {
        escalated++;
        await logEvent("deadline_tracked", {
          agent: "deadline",
          matter: r.matter,
          type: r.type,
          alert_level: level,
          days_remaining: daysUntil(r.due_date),
          escalation: true
        });
      }
    }

    return NextResponse.json({ ok: true, checked: rows.length, escalated });
  } catch (e) {
    console.error("/api/cron/deadlines", e);
    return NextResponse.json({ error: "cron failed" }, { status: 500 });
  }
}
