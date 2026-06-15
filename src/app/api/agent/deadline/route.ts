// POST /api/agent/deadline — the Deadline Agent (Phase 11).
// Given a case type, jurisdiction, and trigger date, it identifies applicable
// statute-of-limitations and procedural deadlines, computes due dates, and tracks
// them with escalating alert levels. A daily cron (/api/cron/deadlines) re-evaluates.
// AI first-pass — every date MUST be verified by an attorney against the rules.
import { NextRequest, NextResponse } from "next/server";
import { runAgent } from "@/lib/anthropic";
import { query } from "@/lib/db";
import { logEvent } from "@/lib/events";
import { firmConfig } from "@/lib/config";
import { alertLevelFor, daysUntil } from "@/lib/deadlines";

export const runtime = "nodejs";
export const maxDuration = 60;

const SYSTEM = `You are the deadline/docketing agent at ${firmConfig.name}. Given a matter's case type, jurisdiction, and trigger date (e.g. date of injury, date served), you identify the key deadlines — especially the statute of limitations — plus standard procedural deadlines, and compute each due date.

You are a first-pass calendaring assistant. Statutes of limitations vary by jurisdiction, claim, and tolling rules; you MUST flag that every date requires attorney verification against the controlling rules. Use web search when helpful to confirm current limitations periods.

Respond with ONLY a JSON object:
{
 "deadlines": [
   {"type":"statute of limitations","due_date":"YYYY-MM-DD","basis":"the rule/period and how the date was computed (e.g. 'NY CPLR 214 — 3 yrs from injury')","priority":"high|medium|low"}
 ],
 "assumptions": ["what you assumed about the trigger date, tolling, etc."],
 "disclaimer": "AI-computed dates are a first pass only. Every deadline — especially the statute of limitations — must be independently verified by a licensed attorney against the controlling rules and any tolling before being relied upon."
}
Never invent a precise date you cannot justify; if the period is uncertain, give your best estimate and explain the uncertainty in basis and assumptions.`;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    const caseType: string = (body?.caseType || "").slice(0, 200);
    const jurisdiction: string = (body?.jurisdiction || "").slice(0, 100);
    const triggerDate: string = (body?.triggerDate || "").slice(0, 40);
    const matter: string = (body?.matter || caseType).slice(0, 300);
    const leadId: string | null = body?.leadId || null;
    if (!caseType || !jurisdiction || !triggerDate) {
      return NextResponse.json({ error: "caseType, jurisdiction, and triggerDate are required" }, { status: 400 });
    }

    const userMsg = `Jurisdiction: ${jurisdiction}\nCase type: ${caseType}\nTrigger date (e.g. injury/service): ${triggerDate}\nToday: ${new Date().toISOString().slice(0, 10)}\n\nIdentify and compute the deadlines now.`;

    let reply: string;
    try {
      ({ reply } = await runAgent({
        system: SYSTEM,
        messages: [{ role: "user", content: userMsg }],
        maxTokens: 1800,
        serverTools: [{ type: "web_search_20250305", name: "web_search", max_uses: 3 }]
      }));
    } catch {
      ({ reply } = await runAgent({
        system: SYSTEM + "\n\nNOTE: web search unavailable — rely on established knowledge and flag currency limits in assumptions.",
        messages: [{ role: "user", content: userMsg }],
        maxTokens: 1800
      }));
    }

    const match = reply.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("deadline agent returned no JSON");
    const parsed = JSON.parse(match[0]);
    const list: { type: string; due_date: string; basis: string; priority?: string }[] =
      Array.isArray(parsed.deadlines) ? parsed.deadlines : [];

    const saved = [];
    for (const d of list) {
      // Skip anything without a concrete, parseable date (e.g. a leftover "YYYY-MM-DD" template).
      if (!d.due_date || !/^\d{4}-\d{2}-\d{2}$/.test(d.due_date) || isNaN(new Date(d.due_date).getTime())) continue;
      const level = alertLevelFor(d.due_date);
      const rows = await query<{ id: string }>(
        `insert into deadlines (lead_id, matter, type, jurisdiction, due_date, basis, alert_level, status)
         values ($1,$2,$3,$4,$5,$6,$7,'open') returning id`,
        [leadId, matter, d.type || "deadline", jurisdiction, d.due_date, d.basis || "", level]
      );
      saved.push({ id: rows[0].id, ...d, alert_level: level, days_remaining: daysUntil(d.due_date) });
    }

    await logEvent("deadline_tracked", {
      agent: "deadline",
      lead_id: leadId,
      matter,
      jurisdiction,
      count: saved.length,
      soonest: saved.reduce<number | null>((m, s) => (m === null ? s.days_remaining : Math.min(m, s.days_remaining)), null)
    });

    return NextResponse.json({ ok: true, deadlines: saved, assumptions: parsed.assumptions, disclaimer: parsed.disclaimer });
  } catch (e) {
    console.error("/api/agent/deadline", e);
    return NextResponse.json({ error: e instanceof Error ? e.message : "deadline agent failed" }, { status: 500 });
  }
}

// GET /api/agent/deadline — open deadlines, alert level recomputed live, soonest first.
export async function GET() {
  try {
    const rows = await query<{ id: string; matter: string; type: string; jurisdiction: string; due_date: string; basis: string; status: string; created_at: string }>(
      "select id, matter, type, jurisdiction, due_date, basis, status, created_at from deadlines where status = 'open' order by due_date asc limit 50"
    );
    const deadlines = rows.map((r) => ({ ...r, alert_level: alertLevelFor(r.due_date), days_remaining: daysUntil(r.due_date) }));
    return NextResponse.json({ deadlines });
  } catch (e) {
    console.error("/api/agent/deadline GET", e);
    return NextResponse.json({ error: "query failed" }, { status: 500 });
  }
}
