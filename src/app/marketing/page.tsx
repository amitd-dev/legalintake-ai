"use client";

// Marketing workspace: (1) live SOURCE PERFORMANCE table — which channels actually
// convert, straight from the leads table; (2) the Marketing Agent drafts channel-ready
// campaign concepts + ad copy grounded in that data. AI first-pass — bar-advertising
// compliance review required before anything is published.
import { useEffect, useState } from "react";
import Shell from "@/components/Shell";

type SourceStat = {
  source: string;
  leads: number;
  qualified: number;
  booked: number;
  conversion: number;
  pipeline_value: number;
};

type Campaign = {
  id: string;
  name: string;
  goal: string;
  channel: string;
  audience: string;
  content: {
    campaign_name?: string;
    objective?: string;
    audience?: string;
    data_insight?: string;
    channel_plan?: { channel: string; rationale: string; suggested_budget_share: string }[];
    ads?: { channel: string; headline: string; primary_text: string; cta: string; format: string }[];
    kpis?: string[];
    disclaimer?: string;
  };
  created_at: string;
};

const HAIR = "border-white/[0.06]";
const PANEL = `rounded-lg border ${HAIR} bg-[#101012]`;
const LABEL = "text-[10px] font-medium uppercase tracking-[0.14em] text-zinc-500";
const BTN =
  "rounded-md border border-white/[0.1] bg-white/[0.04] px-3.5 py-2 text-[12.5px] font-medium text-zinc-100 hover:bg-white/[0.08] disabled:opacity-40";

const CHANNELS = ["auto", "google", "facebook", "instagram", "email"];
const money = (v: number) => "$" + Number(v).toLocaleString("en-US", { maximumFractionDigits: 0 });

function SourcePerformance({ stats }: { stats: SourceStat[] }) {
  const best = stats.reduce<SourceStat | null>((a, b) => (b.leads >= 3 && b.conversion > (a?.conversion ?? -1) ? b : a), null);
  return (
    <div className={PANEL}>
      <div className={`flex items-baseline justify-between border-b ${HAIR} px-5 py-3.5`}>
        <p className={LABEL}>Source performance</p>
        <p className="text-[11px] text-zinc-500">live from leads · which channels convert</p>
      </div>
      {stats.length === 0 ? (
        <p className="px-5 py-6 text-[13px] text-zinc-500">No lead history yet.</p>
      ) : (
        <table className="w-full text-[12.5px]">
          <thead>
            <tr className="text-left text-[10px] uppercase tracking-[0.12em] text-zinc-500">
              <th className="px-5 py-2 font-medium">Source</th>
              <th className="py-2 text-right font-medium">Leads</th>
              <th className="py-2 text-right font-medium">Qualified</th>
              <th className="py-2 text-right font-medium">Booked</th>
              <th className="py-2 text-right font-medium">Conv.</th>
              <th className="px-5 py-2 text-right font-medium">Pipeline</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.04]">
            {stats.map((s) => (
              <tr key={s.source} className={best?.source === s.source ? "bg-emerald-400/[0.04]" : ""}>
                <td className="px-5 py-2.5">
                  <span className="flex items-center gap-2 font-medium text-zinc-200">
                    {s.source}
                    {best?.source === s.source && (
                      <span className="rounded bg-emerald-400/10 px-1.5 py-0.5 text-[9px] font-semibold text-emerald-300">
                        TOP CONVERTER
                      </span>
                    )}
                  </span>
                </td>
                <td className="tnum py-2.5 text-right text-zinc-300">{s.leads}</td>
                <td className="tnum py-2.5 text-right text-zinc-300">{s.qualified}</td>
                <td className="tnum py-2.5 text-right text-zinc-400">{s.booked}</td>
                <td className="tnum py-2.5 text-right font-semibold text-zinc-100">{Math.round(s.conversion * 100)}%</td>
                <td className="tnum px-5 py-2.5 text-right text-[#e3b341]">{money(s.pipeline_value)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

export default function Marketing() {
  const [stats, setStats] = useState<SourceStat[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [goal, setGoal] = useState("");
  const [channel, setChannel] = useState(CHANNELS[0]);
  const [audience, setAudience] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function load() {
    const r = await fetch("/api/agent/marketing", { cache: "no-store" });
    const d = await r.json();
    if (d.sourceStats) setStats(d.sourceStats);
    if (d.campaigns) setCampaigns(d.campaigns);
  }
  useEffect(() => {
    load();
  }, []);

  async function run() {
    if (!goal.trim() || busy) return;
    setBusy(true);
    setErr(null);
    try {
      const r = await fetch("/api/agent/marketing", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ goal, channel, audience })
      });
      const d = await r.json();
      if (!r.ok || d.error) setErr(d.error || "campaign generation failed");
      else {
        setGoal("");
        setAudience("");
        await load();
        setSelected(d.campaignId);
      }
    } catch {
      setErr("network error");
    }
    setBusy(false);
  }

  const c = campaigns.find((x) => x.id === selected) || null;

  return (
    <Shell active="Marketing">
      <header className="sticky top-0 z-10 border-b border-white/[0.06] bg-[#0a0a0b]/90 backdrop-blur">
        <div className="px-6 py-3">
          <h1 className="text-[14px] font-semibold tracking-tight">Marketing</h1>
          <p className="text-[10.5px] text-zinc-500">Source analytics + AI campaign drafting — compliance review required</p>
        </div>
      </header>

      <main className="space-y-4 px-6 py-5">
        <SourcePerformance stats={stats} />

        {/* generator */}
        <div className={`${PANEL} p-5`}>
          <p className={`${LABEL} mb-3`}>Marketing Agent — new campaign</p>
          <div className="flex flex-col gap-2.5 md:flex-row">
            <input
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && run()}
              placeholder="e.g. Drive personal-injury consultations in Newark this quarter"
              className="flex-1 rounded-md border border-white/[0.08] bg-black/30 px-3.5 py-2.5 text-[13px] outline-none focus:border-sky-400/50"
            />
            <select
              value={channel}
              onChange={(e) => setChannel(e.target.value)}
              className="rounded-md border border-white/[0.1] bg-[#0a0a0b] px-3 py-2 text-[12.5px] outline-none focus:border-sky-400/50"
            >
              {CHANNELS.map((j) => (
                <option key={j}>{j}</option>
              ))}
            </select>
            <button onClick={run} disabled={busy || !goal.trim()} className={BTN}>
              {busy ? "Drafting…" : "Draft campaign"}
            </button>
          </div>
          <input
            value={audience}
            onChange={(e) => setAudience(e.target.value)}
            placeholder="Audience (optional) — e.g. recent accident victims, 25-55, NJ"
            className="mt-2.5 w-full rounded-md border border-white/[0.08] bg-black/30 px-3.5 py-2 text-[12.5px] outline-none focus:border-sky-400/50"
          />
          {err && <p className="mt-2 text-[12px] text-red-300">⚠ {err}</p>}
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[320px_1fr]">
          {/* campaign list */}
          <div className={PANEL}>
            <div className={`border-b ${HAIR} px-5 py-3.5`}>
              <p className={LABEL}>Campaigns</p>
            </div>
            <div className="divide-y divide-white/[0.04]">
              {campaigns.length === 0 && <p className="px-5 py-6 text-[13px] text-zinc-500">No campaigns yet.</p>}
              {campaigns.map((m) => (
                <button
                  key={m.id}
                  onClick={() => setSelected(m.id)}
                  className={`block w-full px-5 py-3 text-left hover:bg-white/[0.03] ${selected === m.id ? "bg-white/[0.05]" : ""}`}
                >
                  <p className="line-clamp-2 text-[12.5px] text-zinc-200">{m.content.campaign_name || m.name}</p>
                  <p className="mt-1 text-[10.5px] text-zinc-500">
                    {m.channel} ·{" "}
                    {new Date(m.created_at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                  </p>
                </button>
              ))}
            </div>
          </div>

          {/* campaign viewer */}
          <div className="space-y-4">
            {!c && <div className={`${PANEL} p-8 text-center text-[13px] text-zinc-500`}>Select or draft a campaign.</div>}
            {c && (
              <div className={`${PANEL} p-6`}>
                <p className="rounded-md border border-amber-400/25 bg-amber-400/[0.07] px-3.5 py-2.5 text-[11.5px] leading-relaxed text-amber-200/90">
                  {c.content.disclaimer ||
                    "AI-drafted marketing concept. Review for compliance with applicable bar advertising rules before publishing. Attorney Advertising. Prior results do not guarantee a similar outcome."}
                </p>

                <div className="mt-5 space-y-5 text-[13px] leading-relaxed">
                  <section>
                    <p className={LABEL}>Objective</p>
                    <p className="mt-1.5 text-zinc-200">{c.content.objective}</p>
                  </section>
                  <section>
                    <p className={LABEL}>Audience</p>
                    <p className="mt-1.5 text-zinc-200">{c.content.audience}</p>
                  </section>
                  {c.content.data_insight && (
                    <section>
                      <p className={LABEL}>Data insight</p>
                      <p className="mt-1.5 rounded-md border border-sky-400/20 bg-sky-400/[0.05] px-3 py-2 text-sky-200/90">
                        {c.content.data_insight}
                      </p>
                    </section>
                  )}

                  {c.content.channel_plan && c.content.channel_plan.length > 0 && (
                    <section>
                      <p className={LABEL}>Channel plan &amp; budget</p>
                      <div className="mt-2 divide-y divide-white/[0.04] rounded-md border border-white/[0.06]">
                        {c.content.channel_plan.map((p, i) => (
                          <div key={i} className="flex items-start gap-3 px-3.5 py-2.5">
                            <span className="mt-0.5 w-16 flex-shrink-0 rounded bg-white/[0.06] px-1.5 py-0.5 text-center text-[10px] font-semibold uppercase text-zinc-300">
                              {p.channel}
                            </span>
                            <p className="min-w-0 flex-1 text-[12.5px] text-zinc-400">{p.rationale}</p>
                            <span className="tnum flex-shrink-0 text-[12px] font-semibold text-emerald-300">{p.suggested_budget_share}</span>
                          </div>
                        ))}
                      </div>
                    </section>
                  )}

                  {c.content.ads && c.content.ads.length > 0 && (
                    <section>
                      <p className={LABEL}>Ad variants</p>
                      <div className="mt-2 grid grid-cols-1 gap-2.5 md:grid-cols-2">
                        {c.content.ads.map((a, i) => (
                          <div key={i} className="rounded-md border border-white/[0.07] bg-black/20 p-3.5">
                            <div className="mb-1.5 flex items-center gap-2">
                              <span className="rounded bg-sky-400/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase text-sky-300">
                                {a.channel}
                              </span>
                              <span className="text-[9.5px] uppercase tracking-wide text-zinc-600">{a.format}</span>
                            </div>
                            <p className="text-[13px] font-semibold text-zinc-100">{a.headline}</p>
                            <p className="mt-1 text-[12px] text-zinc-400">{a.primary_text}</p>
                            <p className="mt-2 inline-block rounded border border-emerald-400/30 bg-emerald-400/10 px-2 py-0.5 text-[10.5px] font-medium text-emerald-300">
                              {a.cta}
                            </p>
                          </div>
                        ))}
                      </div>
                    </section>
                  )}

                  {c.content.kpis && c.content.kpis.length > 0 && (
                    <section>
                      <p className={LABEL}>KPIs to track</p>
                      <ul className="mt-1.5 list-disc space-y-1 pl-5 text-zinc-400">
                        {c.content.kpis.map((k, i) => (
                          <li key={i}>{k}</li>
                        ))}
                      </ul>
                    </section>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </Shell>
  );
}
