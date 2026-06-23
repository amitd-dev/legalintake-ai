// POST /api/agent/billing — the Billing Agent (Phase 10).
// Turns matter activity (intake, consultation notes, documents, bookings) into
// itemized, defensible time entries and compiles them into a draft invoice.
// Stripe payment links are stubbed. AI first-pass — a human must review before billing.
import { NextRequest, NextResponse } from "next/server";
import { runAgent } from "@/lib/anthropic";
import { query } from "@/lib/db";
import { logEvent } from "@/lib/events";
import { firmConfig } from "@/lib/config";
import { paymentLink } from "@/lib/stubs/stripe";

export const runtime = "nodejs";
export const maxDuration = 60;

const DEFAULT_RATE = Number(process.env.BILLING_DEFAULT_RATE || 350);

type LineItem = { entry_date: string; narrative: string; hours: number; rate: number; amount: number };

const SYSTEM = `You are the billing agent at ${firmConfig.name}. You convert a matter's activity into itemized, ethically defensible attorney time entries and compile a draft invoice. You are a first-pass assistant — a human reviews before any client is billed.

Billing rules:
- Each entry needs a specific, professional narrative (what was done and why), reasonable hours in 0.1 increments, and the standard rate unless told otherwise.
- Never inflate time or invent work that isn't supported by the activity provided. If activity is thin, produce fewer entries and note it.
- Bundle trivial tasks; do not bill for clerical work.
- Default hourly rate is $${DEFAULT_RATE} unless a different rate is stated.

Respond with ONLY a JSON object:
{
 "client_name": "the client",
 "matter": "short matter description",
 "line_items": [{"entry_date":"YYYY-MM-DD","narrative":"...","hours":0.0,"rate":${DEFAULT_RATE},"amount":0.0}],
 "subtotal": 0.0,
 "total": 0.0,
 "notes": "any assumptions or gaps the reviewing attorney should check",
 "disclaimer": "AI-drafted billing. Attorney must review entries for accuracy, reasonableness, and compliance with fee agreements and billing guidelines before sending."
}
Produce 6-10 entries that realistically span the matter lifecycle (e.g. initial intake call, conflicts check, consultation, file/record review, legal research, document drafting, client correspondence, calendaring), each on its own date. amount must equal hours*rate for each item; subtotal and total must equal the sum of amounts (no tax unless stated).`;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    const matter: string = (body?.matter || "").slice(0, 600);
    const leadId: string | null = body?.leadId || null;
    const rate: number = Number(body?.rate) > 0 ? Number(body.rate) : DEFAULT_RATE;
    if (!matter && !leadId) {
      return NextResponse.json({ error: "matter description or leadId is required" }, { status: 400 });
    }

    // Pull real matter context when a lead is referenced.
    let context = "";
    let clientName = "";
    if (leadId) {
      const leads = await query<{ name: string; case_type: string; case_summary: string }>(
        "select name, case_type, case_summary from leads where id = $1",
        [leadId]
      );
      if (leads[0]) {
        clientName = leads[0].name;
        context += `\nClient: ${leads[0].name}\nCase type: ${leads[0].case_type}\nSummary: ${leads[0].case_summary}`;
      }
      const acts = await query<{ type: string; payload: Record<string, unknown>; created_at: string }>(
        "select type, payload, created_at from events where (payload->>'lead_id') = $1 order by created_at asc limit 40",
        [leadId]
      );
      if (acts.length) {
        context += "\n\nActivity log:\n" + acts.map((a) => `- ${new Date(a.created_at).toISOString().slice(0, 10)} ${a.type}`).join("\n");
      }
    }

    const userMsg = `Standard rate: $${rate}/hr.\nMatter: ${matter || clientName}${context}\n\nDraft the time entries and invoice now.`;

    const { reply } = await runAgent({
      system: SYSTEM,
      messages: [{ role: "user", content: userMsg }],
      maxTokens: 3000
    });

    const match = reply.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("billing agent returned no JSON");
    const inv = JSON.parse(match[0]);
    const today = new Date().toISOString().slice(0, 10);
    const safeDate = (d: unknown): string => (typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : today);
    const rawItems: LineItem[] = Array.isArray(inv.line_items) ? inv.line_items : [];
    const items: LineItem[] = rawItems.map((it) => ({
      entry_date: safeDate(it.entry_date),
      narrative: String(it.narrative || ""),
      hours: Number(it.hours) || 0,
      rate: Number(it.rate) || rate,
      amount: Number(it.amount) || (Number(it.hours) || 0) * (Number(it.rate) || rate)
    }));
    const subtotal = items.reduce((s, i) => s + (Number(i.amount) || 0), 0);
    const invoiceNumber = `INV-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`;

    const rows = await query<{ id: string }>(
      `insert into invoices (lead_id, invoice_number, client_name, matter, line_items, subtotal, total, status, payment_link)
       values ($1,$2,$3,$4,$5,$6,$7,'draft',$8) returning id`,
      [
        leadId,
        invoiceNumber,
        inv.client_name || clientName || "Client",
        inv.matter || matter,
        JSON.stringify(items),
        subtotal,
        Number(inv.total) || subtotal,
        paymentLink(invoiceNumber, Number(inv.total) || subtotal)
      ]
    );
    const invoiceId = rows[0].id;

    for (const it of items) {
      await query(
        `insert into time_entries (lead_id, invoice_id, entry_date, narrative, hours, rate, amount)
         values ($1,$2,$3,$4,$5,$6,$7)`,
        [leadId, invoiceId, it.entry_date || new Date().toISOString().slice(0, 10), it.narrative || "", Number(it.hours) || 0, Number(it.rate) || rate, Number(it.amount) || 0]
      );
    }

    await logEvent("invoice_drafted", {
      agent: "billing",
      invoice_id: invoiceId,
      lead_id: leadId,
      name: inv.client_name || clientName || "Client",
      total: Number(inv.total) || subtotal,
      entries: items.length
    });

    return NextResponse.json({ ok: true, invoiceId, invoice: { ...inv, invoice_number: invoiceNumber, subtotal, line_items: items } });
  } catch (e) {
    console.error("/api/agent/billing", e);
    return NextResponse.json({ error: e instanceof Error ? e.message : "billing agent failed" }, { status: 500 });
  }
}

// GET /api/agent/billing — recent invoices with their line items.
export async function GET() {
  try {
    const invoices = await query(
      "select id, lead_id, invoice_number, client_name, matter, line_items, subtotal, total, status, payment_link, created_at from invoices order by created_at desc limit 20"
    );
    return NextResponse.json({ invoices });
  } catch (e) {
    console.error("/api/agent/billing GET", e);
    return NextResponse.json({ error: "query failed" }, { status: 500 });
  }
}
