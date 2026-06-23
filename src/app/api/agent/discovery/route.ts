// POST /api/agent/discovery — the Discovery Agent (Phase 9).
// Reviews a batch of documents: extracts key facts, flags relevant passages with
// issue tags and a relevance score, and builds a chronology. AI first-pass over
// the provided text — an attorney must confirm relevance, privilege, and completeness.
import { NextRequest, NextResponse } from "next/server";
import { runAgent } from "@/lib/anthropic";
import { query } from "@/lib/db";
import { logEvent } from "@/lib/events";
import { firmConfig } from "@/lib/config";

export const runtime = "nodejs";
export const maxDuration = 60;

type Doc = { name: string; text: string };

const SYSTEM = `You are the discovery/document-review agent at ${firmConfig.name}. You review the provided documents and produce a structured first-pass review for an attorney. You only analyze the text given to you — you never invent documents, dates, or facts not present in it.

Respond with ONLY a JSON object:
{
 "findings": [{"doc":"which document","excerpt":"the relevant passage, quoted or tightly paraphrased","issue_tag":"liability|damages|timeline|credibility|privilege|notice|causation|other","relevance":0.0,"note":"why it matters"}],
 "chronology": [{"date":"YYYY-MM-DD or best available","event":"what happened","source":"which document"}],
 "summary": "2-4 sentence overview of what these documents establish and the biggest open questions",
 "privilege_flags": ["any documents/passages that may be privileged or need a closer privilege review"],
 "disclaimer": "AI-generated first-pass review of the provided text only. An attorney must verify relevance, completeness, privilege, and that nothing material was missed before any production or reliance."
}
relevance is 0.0-1.0. Order findings by relevance, highest first. Produce 5-8 findings where the documents support them (fewer only if the text is genuinely thin — say so in the summary). Build a chronology covering every dated event you can identify, in order. Flag anything that looks privileged.`;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    const name: string = (body?.name || "Document batch").slice(0, 200);
    const leadId: string | null = body?.leadId || null;
    let docs: Doc[] = Array.isArray(body?.documents) ? body.documents : [];
    if (!docs.length && typeof body?.text === "string" && body.text.trim()) {
      docs = [{ name: "Document 1", text: body.text }];
    }
    docs = docs.filter((d) => d && typeof d.text === "string" && d.text.trim()).slice(0, 10);
    if (!docs.length) {
      return NextResponse.json({ error: "at least one document with text is required" }, { status: 400 });
    }

    const corpus = docs
      .map((d, i) => `=== DOCUMENT ${i + 1}: ${(d.name || `Document ${i + 1}`).slice(0, 120)} ===\n${d.text.slice(0, 6000)}`)
      .join("\n\n");
    const userMsg = `Batch: ${name}\nDocuments to review (${docs.length}):\n\n${corpus}\n\nProduce the structured review now.`;

    const { reply } = await runAgent({
      system: SYSTEM,
      messages: [{ role: "user", content: userMsg }],
      maxTokens: 3600
    });

    const match = reply.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("discovery agent returned no JSON");
    const result = JSON.parse(match[0]);

    const rows = await query<{ id: string }>(
      "insert into discovery_reviews (lead_id, name, doc_count, result) values ($1,$2,$3,$4) returning id",
      [leadId, name, docs.length, JSON.stringify(result)]
    );

    await logEvent("discovery_reviewed", {
      agent: "discovery",
      review_id: rows[0].id,
      lead_id: leadId,
      name,
      docs: docs.length,
      findings: Array.isArray(result.findings) ? result.findings.length : 0
    });

    return NextResponse.json({ ok: true, reviewId: rows[0].id, result });
  } catch (e) {
    console.error("/api/agent/discovery", e);
    return NextResponse.json({ error: e instanceof Error ? e.message : "discovery agent failed" }, { status: 500 });
  }
}

// GET /api/agent/discovery — recent reviews.
export async function GET() {
  try {
    const reviews = await query(
      "select id, lead_id, name, doc_count, result, created_at from discovery_reviews order by created_at desc limit 20"
    );
    return NextResponse.json({ reviews });
  } catch (e) {
    console.error("/api/agent/discovery GET", e);
    return NextResponse.json({ error: "query failed" }, { status: 500 });
  }
}
