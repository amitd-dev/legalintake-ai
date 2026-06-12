// POST /api/agent/drafting — the Drafting Agent (Phase 7).
// Input: { leadId, docType }. Generates a first-draft legal document from the
// lead record + consultation notes, stores it in `documents`, logs an event.
import { NextRequest, NextResponse } from "next/server";
import { runAgent } from "@/lib/anthropic";
import { query } from "@/lib/db";
import { logEvent } from "@/lib/events";
import { firmConfig, attorneyProfile } from "@/lib/config";

export const runtime = "nodejs";
export const maxDuration = 60;

const DOC_TYPES: Record<string, { label: string; instructions: string }> = {
  demand_letter: {
    label: "Demand Letter",
    instructions:
      "A demand letter to the opposing party/insurer: state representation, factual basis of liability, itemize damages known from the record, set a 21-day response deadline, reserve all rights. Firm but professional tone."
  },
  engagement_letter: {
    label: "Engagement Letter",
    instructions:
      "An engagement letter to the client: scope of representation tailored to the matter, fee structure (contingency 33⅓% for personal injury; otherwise hourly with retainer), client responsibilities, confidentiality, termination clause, signature blocks for attorney and client."
  },
  nda: {
    label: "Mutual NDA",
    instructions:
      "A short mutual non-disclosure agreement between the client and the counterpart identified in the matter: definition of confidential information, obligations, 2-year term, governing law of the firm's state, signature blocks."
  },
  follow_up_letter: {
    label: "Client Follow-Up Letter",
    instructions:
      "A status/follow-up letter to the client: recap of the matter, what the firm has done so far (from the record), the documents the client still needs to provide, and concrete next steps with rough timeline."
  }
};

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    const leadId: string = body?.leadId;
    const docType: string = body?.docType;
    const def = DOC_TYPES[docType];
    if (!leadId || !def) {
      return NextResponse.json({ error: "leadId and valid docType required (" + Object.keys(DOC_TYPES).join(", ") + ")" }, { status: 400 });
    }

    const [lead] = await query<Record<string, unknown>>("select * from leads where id=$1", [leadId]);
    if (!lead) return NextResponse.json({ error: "lead not found" }, { status: 404 });
    const notes = await query<{ structured: unknown }>(
      "select structured from consultation_notes where lead_id=$1 order by created_at desc limit 1",
      [leadId]
    );

    const system = `You are the document-drafting agent at ${firmConfig.name}. Attorney of record: ${attorneyProfile.givenName} ${attorneyProfile.familyName} (${attorneyProfile.licensingAuthority} #${attorneyProfile.barNumber}), ${attorneyProfile.street}, ${attorneyProfile.city}, ${attorneyProfile.state} ${attorneyProfile.zip}.

Draft: ${def.instructions}

RULES:
- Plain text only, no markdown. Start with the firm letterhead line, today's date (${new Date().toDateString()}), and "DRAFT — FOR ATTORNEY REVIEW".
- Use ONLY facts present in the record. Write [PLACEHOLDER: description] for anything required but unknown — never invent names, dates, amounts, or addresses.
- 350-500 words. Professional, precise, no legalese padding.
- Respond with ONLY the document text.`;

    const { reply: text } = await runAgent({
      system,
      messages: [
        {
          role: "user",
          content:
            "Intake record:\n" + JSON.stringify(lead, null, 2) +
            "\n\nConsultation notes:\n" + (notes.length ? JSON.stringify(notes[0].structured, null, 2) : "(none)")
        }
      ],
      maxTokens: 1400
    });

    const filename = `${def.label.replace(/\s+/g, "_")}_${String(lead.name || "client").replace(/[^a-z0-9]+/gi, "_")}.txt`;
    const rows = await query<{ id: string }>(
      `insert into documents (lead_id, type, status, filename, content, field_data)
       values ($1,$2,'draft',$3,$4,$5) returning id`,
      [leadId, docType, filename, Buffer.from(text, "utf8"), JSON.stringify({ doc_type: def.label })]
    );
    await logEvent("document_generated", {
      agent: "drafting",
      lead_id: leadId,
      document_id: rows[0].id,
      doc_type: def.label,
      name: lead.name
    });

    return NextResponse.json({ ok: true, documentId: rows[0].id, filename, downloadUrl: `/api/documents/${rows[0].id}` });
  } catch (e) {
    console.error("/api/agent/drafting", e);
    return NextResponse.json({ error: e instanceof Error ? e.message : "drafting agent failed" }, { status: 500 });
  }
}
