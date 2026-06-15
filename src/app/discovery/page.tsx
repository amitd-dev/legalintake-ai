"use client";

// Discovery workspace: paste document text → the Discovery Agent extracts findings
// (with issue tags + relevance), builds a chronology, and flags privilege. AI
// first-pass over the provided text — attorney verification required.
import { useEffect, useState } from "react";
import Shell from "@/components/Shell";

type Finding = { doc: string; excerpt: string; issue_tag: string; relevance: number; note: string };
type ChronItem = { date: string; event: string; source: string };
type Review = {
  id: string;
  name: string;
  doc_count: number;
  result: {
    findings?: Finding[];
    chronology?: ChronItem[];
    summary?: string;
    privilege_flags?: string[];
    disclaimer?: string;
  };
  created_at: string;
};

const HAIR = "border-white/[0.06]";
const PANEL = `rounded-lg border ${HAIR} bg-[#101012]`;
const LABEL = "text-[10px] font-medium uppercase tracking-[0.14em] text-zinc-500";
const BTN =
  "rounded-md border border-white/[0.1] bg-white/[0.04] px-3.5 py-2 text-[12.5px] font-medium text-zinc-100 hover:bg-white/[0.08] disabled:opacity-40";

const TAG_CLS: Record<string, string> = {
  liability: "bg-red-400/10 text-red-300",
  damages: "bg-[#e3b341]/10 text-[#e3b341]",
  timeline: "bg-sky-400/10 text-sky-300",
  credibility: "bg-violet-400/10 text-violet-300",
  privilege: "bg-pink-400/10 text-pink-300",
  notice: "bg-emerald-400/10 text-emerald-300",
  causation: "bg-orange-400/10 text-orange-300"
};
const tagCls = (t: string) => TAG_CLS[t] || "bg-zinc-400/10 text-zinc-300";

export default function Discovery() {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function load() {
    const r = await fetch("/api/agent/discovery", { cache: "no-store" });
    const d = await r.json();
    if (d.reviews) setReviews(d.reviews);
  }
  useEffect(() => {
    load();
  }, []);

  async function run() {
    if (!text.trim() || busy) return;
    setBusy(true);
    setErr(null);
    try {
      const r = await fetch("/api/agent/discovery", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: name || "Document batch", text })
      });
      const d = await r.json();
      if (!r.ok || d.error) setErr(d.error || "review failed");
      else {
        setText("");
        setName("");
        await load();
        setSelected(d.reviewId);
      }
    } catch {
      setErr("network error");
    }
    setBusy(false);
  }

  const rev = reviews.find((x) => x.id === selected) || null;

  return (
    <Shell active="Discovery">
      <header className="sticky top-0 z-10 border-b border-white/[0.06] bg-[#0a0a0b]/90 backdrop-blur">
        <div className="px-6 py-3">
          <h1 className="text-[14px] font-semibold tracking-tight">Discovery</h1>
          <p className="text-[10.5px] text-zinc-500">AI first-pass document review — attorney verification required</p>
        </div>
      </header>

      <main className="space-y-4 px-6 py-5">
        <div className={`${PANEL} p-5`}>
          <p className={`${LABEL} mb-3`}>Discovery Agent — review documents</p>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Batch name — e.g. Defendant production, set 1"
            className="mb-2.5 w-full rounded-md border border-white/[0.08] bg-black/30 px-3.5 py-2 text-[12.5px] outline-none focus:border-sky-400/50"
          />
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Paste document text here (emails, reports, statements). Separate multiple documents with a line of ===."
            rows={7}
            className="w-full resize-y rounded-md border border-white/[0.08] bg-black/30 px-3.5 py-2.5 font-mono text-[12px] leading-relaxed outline-none focus:border-sky-400/50"
          />
          <div className="mt-2.5 flex items-center justify-between">
            <p className="text-[10.5px] text-zinc-600">Text only — first pass over what you paste; nothing is produced or disclosed.</p>
            <button onClick={run} disabled={busy || !text.trim()} className={BTN}>
              {busy ? "Reviewing…" : "Review documents"}
            </button>
          </div>
          {err && <p className="mt-2 text-[12px] text-red-300">⚠ {err}</p>}
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[300px_1fr]">
          <div className={PANEL}>
            <div className={`border-b ${HAIR} px-5 py-3.5`}>
              <p className={LABEL}>Reviews</p>
            </div>
            <div className="divide-y divide-white/[0.04]">
              {reviews.length === 0 && <p className="px-5 py-6 text-[13px] text-zinc-500">No reviews yet.</p>}
              {reviews.map((m) => (
                <button
                  key={m.id}
                  onClick={() => setSelected(m.id)}
                  className={`block w-full px-5 py-3 text-left hover:bg-white/[0.03] ${selected === m.id ? "bg-white/[0.05]" : ""}`}
                >
                  <p className="truncate text-[12.5px] text-zinc-200">{m.name}</p>
                  <p className="mt-1 text-[10.5px] text-zinc-500">
                    {m.doc_count} doc{m.doc_count === 1 ? "" : "s"} · {(m.result.findings?.length ?? 0)} findings ·{" "}
                    {new Date(m.created_at).toLocaleString("en-US", { month: "short", day: "numeric" })}
                  </p>
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-4">
            {!rev && <div className={`${PANEL} p-8 text-center text-[13px] text-zinc-500`}>Select or run a review.</div>}
            {rev && (
              <div className={`${PANEL} p-6`}>
                <p className="rounded-md border border-amber-400/25 bg-amber-400/[0.07] px-3.5 py-2.5 text-[11.5px] leading-relaxed text-amber-200/90">
                  {rev.result.disclaimer ||
                    "AI-generated first-pass review of the provided text only. An attorney must verify relevance, privilege, and completeness before any production or reliance."}
                </p>

                <div className="mt-5 space-y-5">
                  {rev.result.summary && (
                    <section>
                      <p className={LABEL}>Summary</p>
                      <p className="mt-1.5 text-[13px] leading-relaxed text-zinc-300">{rev.result.summary}</p>
                    </section>
                  )}

                  {rev.result.findings && rev.result.findings.length > 0 && (
                    <section>
                      <p className={LABEL}>Findings — by relevance</p>
                      <div className="mt-2 space-y-2">
                        {rev.result.findings.map((f, i) => (
                          <div key={i} className="rounded-md border border-white/[0.06] bg-black/20 p-3.5">
                            <div className="mb-1.5 flex items-center gap-2">
                              <span className={`rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase ${tagCls(f.issue_tag)}`}>
                                {f.issue_tag}
                              </span>
                              <span className="text-[10px] text-zinc-600">{f.doc}</span>
                              <span className="ml-auto flex items-center gap-1.5">
                                <span className="h-1 w-16 overflow-hidden rounded-full bg-white/[0.08]">
                                  <span className="block h-full rounded-full bg-emerald-400/70" style={{ width: `${Math.round((Number(f.relevance) || 0) * 100)}%` }} />
                                </span>
                                <span className="tnum text-[10px] text-zinc-500">{Math.round((Number(f.relevance) || 0) * 100)}%</span>
                              </span>
                            </div>
                            <p className="text-[12.5px] italic text-zinc-300">“{f.excerpt}”</p>
                            <p className="mt-1 text-[11.5px] text-zinc-500">{f.note}</p>
                          </div>
                        ))}
                      </div>
                    </section>
                  )}

                  {rev.result.chronology && rev.result.chronology.length > 0 && (
                    <section>
                      <p className={LABEL}>Chronology</p>
                      <div className="mt-2 space-y-0">
                        {rev.result.chronology.map((c, i) => (
                          <div key={i} className="flex gap-3 border-l border-white/[0.1] py-1.5 pl-4">
                            <span className="tnum w-24 flex-shrink-0 text-[11.5px] font-medium text-sky-300/80">{c.date}</span>
                            <div className="min-w-0">
                              <p className="text-[12.5px] text-zinc-300">{c.event}</p>
                              <p className="text-[10.5px] text-zinc-600">{c.source}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </section>
                  )}

                  {rev.result.privilege_flags && rev.result.privilege_flags.length > 0 && (
                    <section>
                      <p className={LABEL}>Privilege flags</p>
                      <ul className="mt-1.5 list-disc space-y-1 pl-5 text-[12.5px] text-pink-200/80">
                        {rev.result.privilege_flags.map((p, i) => (
                          <li key={i}>{p}</li>
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
