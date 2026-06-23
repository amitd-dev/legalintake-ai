// POST /api/agent/research — the Legal Research Agent (Phase 8).
// Input: { question, jurisdiction, leadId? }. Produces a structured research memo
// (issue, short answer, analysis, authorities, caveats, citation-verification
// checklist) using Claude with web search when available. AI first-pass only —
// every memo carries a mandatory attorney-verification disclaimer.
import { NextRequest, NextResponse } from "next/server";
import { runAgent } from "@/lib/anthropic";
import { query } from "@/lib/db";
import { logEvent } from "@/lib/events";
import { firmConfig } from "@/lib/config";

export const runtime = "nodejs";
export const maxDuration = 60;

const SYSTEM = `You are the legal research agent at ${firmConfig.name}. You produce a structured FIRST-PASS research memo for an attorney. You are not the final word — the attorney must verify everything.

Use web search when helpful to find current authorities. Respond with ONLY a JSON object:
{
 "issue": "the legal question, precisely framed",
 "short_answer": "3-5 sentence direct answer with an explicit confidence level (likely/unclear/jurisdiction-dependent) and the governing rule named",
 "analysis": "thorough reasoning in 4-6 substantive paragraphs: state the rule, apply it to the facts, address the strongest counter-argument, and note how courts have treated similar cases — plain prose, no headers",
 "authorities": [{"citation":"specific case/statute/regulation cite","relevance":"one or two sentences on what it establishes and why it matters here","verified":false}],
 "caveats": ["4-6 concrete limitations: splits of authority, tolling/exceptions, recency concerns, fact-dependence"],
 "citation_checklist": ["Confirm each citation exists and is good law (not overruled/superseded)","Check currency of statutes cited against the official code","Verify quotations against primary sources","Confirm jurisdiction-specific application","Check for post-research developments"],
 "disclaimer": "AI-generated first-pass research. All citations must be independently verified by a licensed attorney before reliance or filing."
}
Include 5-8 genuinely on-point authorities where they exist. Every authority MUST have verified:false. If you could not verify something via search, say so in caveats. Never fabricate citations — fewer, real authorities beat many invented ones.`;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    const question: string = (body?.question || "").slice(0, 2000);
    const jurisdiction: string = (body?.jurisdiction || "").slice(0, 100);
    const leadId: string | null = body?.leadId || null;
    if (!question || !jurisdiction) {
      return NextResponse.json({ error: "question and jurisdiction are required" }, { status: 400 });
    }

    const userMsg = `Jurisdiction: ${jurisdiction}\n\nResearch question: ${question}`;
    // `fast` skips web search (used by the demo runner) so the call stays well under the function time limit
    const fast: boolean = body?.fast === true;
    let reply: string;
    try {
      if (fast) throw new Error("skip-web-search");
      // try with Anthropic server-side web search
      ({ reply } = await runAgent({
        system: SYSTEM,
        messages: [{ role: "user", content: userMsg }],
        maxTokens: 3500,
        serverTools: [{ type: "web_search_20250305", name: "web_search", max_uses: 4 }]
      }));
    } catch {
      // account may not have web search enabled — degrade gracefully
      ({ reply } = await runAgent({
        system: SYSTEM + "\n\nNOTE: web search unavailable — rely on established knowledge, flag currency limits prominently in caveats.",
        messages: [{ role: "user", content: userMsg }],
        maxTokens: 2500
      }));
    }

    const match = reply.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("research agent returned no JSON");
    const memo = JSON.parse(match[0]);

    const rows = await query<{ id: string }>(
      "insert into research_memos (lead_id, question, jurisdiction, memo) values ($1,$2,$3,$4) returning id",
      [leadId, question, jurisdiction, JSON.stringify(memo)]
    );
    await logEvent("research_memo", {
      agent: "research",
      memo_id: rows[0].id,
      lead_id: leadId,
      jurisdiction,
      question: question.slice(0, 120),
      authorities: Array.isArray(memo.authorities) ? memo.authorities.length : 0
    });

    return NextResponse.json({ ok: true, memoId: rows[0].id, memo });
  } catch (e) {
    console.error("/api/agent/research", e);
    return NextResponse.json({ error: e instanceof Error ? e.message : "research agent failed" }, { status: 500 });
  }
}

// GET /api/agent/research — list recent memos
export async function GET() {
  try {
    const memos = await query(
      "select id, lead_id, question, jurisdiction, memo, created_at from research_memos order by created_at desc limit 20"
    );
    return NextResponse.json({ memos });
  } catch (e) {
    console.error("/api/agent/research GET", e);
    return NextResponse.json({ error: "query failed" }, { status: 500 });
  }
}
