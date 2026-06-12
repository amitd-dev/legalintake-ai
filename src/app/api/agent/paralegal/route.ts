// POST /api/agent/paralegal — the Paralegal Form-Filling agent.
// Input: { leadId }. Reads the lead record + latest consultation notes,
// uses Claude to map case data onto USCIS Form G-28 fields, fills the REAL
// form PDF, stores it in `documents`, and returns a download link.
import { NextRequest, NextResponse } from "next/server";
import { runAgent } from "@/lib/anthropic";
import { query } from "@/lib/db";
import { logEvent } from "@/lib/events";
import { fillG28, type G28ClientData } from "@/lib/formFill";
import { firmConfig } from "@/lib/config";

export const runtime = "nodejs";
export const maxDuration = 60;

const SYSTEM = `You are a meticulous immigration paralegal at ${firmConfig.name} preparing USCIS Form G-28 (Notice of Entry of Appearance as Attorney).

You receive the client's intake record and consultation notes. Respond with ONLY a JSON object with these keys (use null when truly unknown — NEVER invent data):
{
 "clientFamilyName": "...", "clientGivenName": "...", "clientMiddleName": null,
 "clientPhone": null, "clientMobile": null, "clientEmail": null,
 "clientStreet": null, "clientApt": null, "clientCity": null, "clientState": "2-letter or null", "clientZip": null,
 "clientRole": "applicant|petitioner|requestor|beneficiary — infer from the matter",
 "matterDescription": "form number + matter, e.g. \\"I-130, Petition for Alien Relative\\" or a short matter description",
 "uscisAccountNumber": null, "receiptNumber": null,
 "missing_for_filing": ["fields a human must still collect before filing"]
}`;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    const leadId: string = body?.leadId;
    if (!leadId) return NextResponse.json({ error: "leadId required" }, { status: 400 });

    const [lead] = await query<Record<string, unknown>>("select * from leads where id=$1", [leadId]);
    if (!lead) return NextResponse.json({ error: "lead not found" }, { status: 404 });
    const notes = await query<{ structured: unknown; transcript: string }>(
      "select structured, transcript from consultation_notes where lead_id=$1 order by created_at desc limit 1",
      [leadId]
    );

    /* 1) paralegal agent maps case data to form fields */
    const { reply } = await runAgent({
      system: SYSTEM,
      messages: [
        {
          role: "user",
          content:
            "Intake record:\n" + JSON.stringify(lead, null, 2) +
            "\n\nConsultation notes:\n" + (notes.length ? JSON.stringify(notes[0].structured, null, 2) : "(no consultation notes yet)")
        }
      ],
      maxTokens: 1000
    });
    const match = reply.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("paralegal agent returned no JSON");
    const mapped = JSON.parse(match[0]) as G28ClientData & { missing_for_filing?: string[] };

    /* 2) fill the real USCIS PDF */
    const origin = req.nextUrl.origin;
    const tpl = await fetch(`${origin}/forms/g-28-template.pdf`);
    if (!tpl.ok) throw new Error("form template not reachable");
    const filled = await fillG28(new Uint8Array(await tpl.arrayBuffer()), mapped);

    /* 3) persist + event */
    const filename = `G-28_${String(lead.name || "client").replace(/[^a-z0-9]+/gi, "_")}.pdf`;
    const rows = await query<{ id: string }>(
      `insert into documents (lead_id, type, status, filename, content, field_data)
       values ($1,'g-28','draft',$2,$3,$4) returning id`,
      [leadId, filename, Buffer.from(filled), JSON.stringify(mapped)]
    );
    await logEvent("document_generated", {
      agent: "paralegal",
      lead_id: leadId,
      document_id: rows[0].id,
      doc_type: "USCIS Form G-28",
      name: lead.name,
      missing_for_filing: mapped.missing_for_filing || []
    });

    return NextResponse.json({
      ok: true,
      documentId: rows[0].id,
      filename,
      downloadUrl: `/api/documents/${rows[0].id}`,
      missing_for_filing: mapped.missing_for_filing || []
    });
  } catch (e) {
    console.error("/api/agent/paralegal", e);
    return NextResponse.json({ error: e instanceof Error ? e.message : "paralegal agent failed" }, { status: 500 });
  }
}
