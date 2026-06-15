// POST /api/agent/marketing — the Marketing Agent (Phase 6, firm addition).
// Two jobs: (1) analyze which lead SOURCES actually convert, straight from the
// `leads` table — no guesswork; (2) draft channel-ready ad/campaign copy that is
// grounded in that real conversion data. AI first-pass only: every campaign carries
// a bar-advertising-compliance disclaimer (no guarantees of results, etc.).
import { NextRequest, NextResponse } from "next/server";
import { runAgent } from "@/lib/anthropic";
import { query } from "@/lib/db";
import { logEvent } from "@/lib/events";
import { firmConfig } from "@/lib/config";

export const runtime = "nodejs";
export const maxDuration = 60;

export type SourceStat = {
  source: string;
  leads: number;
  qualified: number;
  booked: number;
  conversion: number; // qualified / leads, 0..1
  pipeline_value: number;
};

// Real source-level performance, computed from leads. This is the "which channels
// convert" analysis the agent reasons over — nothing simulated.
async function sourceStats(): Promise<SourceStat[]> {
  const rows = await query<{
    source: string; leads: string; qualified: string; booked: string; pipeline_value: string;
  }>(`
    select
      coalesce(nullif(source, ''), 'web')                                                as source,
      count(*)                                                                           as leads,
      count(*) filter (where qualification_status in ('qualified','booked'))             as qualified,
      count(*) filter (where qualification_status = 'booked')                            as booked,
      coalesce(sum(estimated_value) filter (where qualification_status in ('qualified','booked')), 0) as pipeline_value
    from leads
    group by 1
    order by leads desc
  `);
  return rows.map((r) => {
    const leads = Number(r.leads);
    const qualified = Number(r.qualified);
    return {
      source: r.source,
      leads,
      qualified,
      booked: Number(r.booked),
      conversion: leads > 0 ? qualified / leads : 0,
      pipeline_value: Number(r.pipeline_value)
    };
  });
}

const SYSTEM = `You are the marketing agent at ${firmConfig.name}, a law firm. You draft channel-ready campaign concepts and ad copy for client acquisition, and you ground every recommendation in the firm's REAL lead-source conversion data (provided to you). You are a first-pass creative+analytics assistant — a human reviews before anything is published.

The firm's practice areas: ${firmConfig.practiceAreas.join(", ")}.

Hard rules for legal advertising (bar ethics) — copy MUST comply:
- Never guarantee or promise a specific result or outcome ("we'll win", "guaranteed settlement").
- No misleading or unverifiable superlatives ("best lawyers", "#1") unless framed as opinion.
- Be truthful and non-deceptive; avoid creating unjustified expectations.
- Where a jurisdiction may require it, the copy is "Attorney Advertising".

Use the conversion data to decide where to focus spend: lean into sources with proven conversion, and write copy suited to each channel's intent (e.g. Google search = high intent, Facebook/Instagram = discovery).

Respond with ONLY a JSON object:
{
 "campaign_name": "short internal name",
 "objective": "the goal in one line",
 "audience": "who this targets, specifically",
 "data_insight": "1-2 sentences citing the actual source numbers you were given and what they imply",
 "channel_plan": [{"channel":"google|facebook|instagram|email|web","rationale":"why, tied to the data","suggested_budget_share":"e.g. 40%"}],
 "ads": [{"channel":"...","headline":"<=40 chars where the channel needs it","primary_text":"the body copy","cta":"e.g. Book a free consultation","format":"search|single image|carousel|email"}],
 "kpis": ["what to measure"],
 "disclaimer": "AI-drafted marketing concept. Review for accuracy and compliance with applicable bar advertising rules before publishing. Attorney Advertising. Prior results do not guarantee a similar outcome."
}
Produce 3-5 ad variants across the channels you recommend. Never invent firm facts (awards, stats, attorney names beyond those configured); keep claims to services offered and the free-consultation intake. If the conversion data is thin, say so in data_insight and recommend a test budget.`;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    const goal: string = (body?.goal || "").slice(0, 600);
    const channelHint: string = (body?.channel || "auto").slice(0, 40);
    const audience: string = (body?.audience || "").slice(0, 300);
    if (!goal) {
      return NextResponse.json({ error: "goal is required" }, { status: 400 });
    }

    const stats = await sourceStats();
    const statLines = stats.length
      ? stats
          .map(
            (s) =>
              `- ${s.source}: ${s.leads} leads, ${s.qualified} qualified (${Math.round(s.conversion * 100)}% conv), ${s.booked} booked, $${s.pipeline_value.toLocaleString()} pipeline`
          )
          .join("\n")
      : "(no lead history yet — recommend a small balanced test budget)";

    const userMsg = `Firm lead-source performance to date:\n${statLines}\n\nCampaign goal: ${goal}\nPreferred channel: ${channelHint}\nTarget audience hint: ${audience || "(none given — infer from goal + practice areas)"}\n\nDraft the campaign now.`;

    const { reply } = await runAgent({
      system: SYSTEM,
      messages: [{ role: "user", content: userMsg }],
      maxTokens: 2500
    });

    const match = reply.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("marketing agent returned no JSON");
    const campaign = JSON.parse(match[0]);

    const rows = await query<{ id: string }>(
      "insert into campaigns (name, goal, channel, audience, content) values ($1,$2,$3,$4,$5) returning id",
      [
        (campaign.campaign_name || goal).slice(0, 200),
        goal,
        channelHint,
        audience || campaign.audience || "",
        JSON.stringify(campaign)
      ]
    );
    await logEvent("campaign_created", {
      agent: "marketing",
      campaign_id: rows[0].id,
      name: campaign.campaign_name || goal.slice(0, 60),
      channels: Array.isArray(campaign.channel_plan) ? campaign.channel_plan.map((c: { channel: string }) => c.channel) : [],
      ads: Array.isArray(campaign.ads) ? campaign.ads.length : 0
    });

    return NextResponse.json({ ok: true, campaignId: rows[0].id, campaign, sourceStats: stats });
  } catch (e) {
    console.error("/api/agent/marketing", e);
    return NextResponse.json({ error: e instanceof Error ? e.message : "marketing agent failed" }, { status: 500 });
  }
}

// GET /api/agent/marketing — recent campaigns + live source-performance analytics.
export async function GET() {
  try {
    const [campaigns, stats] = await Promise.all([
      query(
        "select id, name, goal, channel, audience, content, created_at from campaigns order by created_at desc limit 20"
      ),
      sourceStats()
    ]);
    return NextResponse.json({ campaigns, sourceStats: stats });
  } catch (e) {
    console.error("/api/agent/marketing GET", e);
    return NextResponse.json({ error: "query failed" }, { status: 500 });
  }
}
