// POST /api/agent/notetaker — the AI Note-Taker agent.
// Input: { leadId, transcript }. Structures a consultation transcript into
// case notes (parties, dates, A-numbers, relief sought, action items) and persists them.
import { NextRequest, NextResponse } from "next/server";
import { runAgent } from "@/lib/anthropic";
import { query } from "@/lib/db";
import { logEvent } from "@/lib/events";
import { firmConfig } from "@/lib/config";

export const runtime = "nodejs";
export const maxDuration = 60;

const SYSTEM = `You are the consultation note-taker for ${firmConfig.name}. You receive a raw attorney-client consultation transcript and produce structured case notes for the file.

Respond with ONLY a JSON object:
{
 "case_type": "practice area",
 "parties": [{"name":"...","role":"client|spouse|beneficiary|opposing party|other"}],
 "key_facts": ["chronological fact bullets with dates"],
 "immigration_details": {"a_number":"A-number if mentioned or null","current_status":"...","entry_date":"...","priority_concerns":"..."},
 "relief_or_strategy": "what the attorney proposed",
 "forms_needed": ["e.g. G-28", "I-130"],
 "action_items": [{"owner":"attorney|paralegal|client","task":"...","due":"..."}],
 "summary": "3-4 sentence file summary"
}
Use null/empty arrays when unknown. Extract only what's in the transcript — never invent facts.`;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    const leadId: string = body?.leadId;
    const transcript: string = (body?.transcript || "").slice(0, 30000);
    if (!leadId || !transcript) {
      return NextResponse.json({ error: "leadId and transcript are required" }, { status: 400 });
    }

    const { reply } = await runAgent({
      system: SYSTEM,
      messages: [{ role: "user", content: "Consultation transcript:\n\n" + transcript }],
      maxTokens: 2200
    });
    const match = reply.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("note-taker returned no JSON");
    const structured = JSON.parse(match[0]);

    const rows = await query<{ id: string }>(
      "insert into consultation_notes (lead_id, transcript, structured) values ($1,$2,$3) returning id",
      [leadId, transcript, JSON.stringify(structured)]
    );
    const lead = (await query<{ name: string | null }>("select name from leads where id=$1", [leadId]))[0];
    await logEvent("note_recorded", {
      lead_id: leadId,
      note_id: rows[0].id,
      name: lead?.name,
      case_type: structured.case_type,
      forms_needed: structured.forms_needed
    });

    // AUTONOMOUS HANDOFF: if the notes flag that a USCIS G-28 is needed, the
    // Note-Taker hands the matter to the Paralegal agent on its own — no human click.
    const forms: string[] = Array.isArray(structured.forms_needed) ? structured.forms_needed : [];
    const needsG28 = forms.some((f) => /g[-\s]?28/i.test(String(f)));
    if (needsG28) {
      await logEvent("agent_handoff", {
        from: "notetaker",
        to: "paralegal",
        lead_id: leadId,
        name: lead?.name,
        reason: `Consultation notes flag forms needed (${forms.join(", ")}) — dispatching Paralegal to prepare the G-28.`
      });
      try {
        await fetch(`${req.nextUrl.origin}/api/agent/paralegal`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ leadId, viaHandoff: true })
        });
      } catch (e) {
        console.error("notetaker→paralegal handoff failed", e);
      }
    }

    return NextResponse.json({ ok: true, noteId: rows[0].id, structured });
  } catch (e) {
    console.error("/api/agent/notetaker", e);
    return NextResponse.json({ error: e instanceof Error ? e.message : "note-taker failed" }, { status: 500 });
  }
}
