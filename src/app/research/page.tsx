"use client";

// Research workspace: attorney submits a question + jurisdiction → Research Agent
// produces a structured memo with citation-verification checklist. AI first-pass;
// every memo carries a mandatory attorney-verification disclaimer.
import { useEffect, useState } from "react";
import Shell from "@/components/Shell";

type Memo = {
  id: string;
  question: string;
  jurisdiction: string;
  memo: {
    issue?: string;
    short_answer?: string;
    analysis?: string;
    authorities?: { citation: string; relevance: string; verified: boolean }[];
    caveats?: string[];
    citation_checklist?: string[];
    disclaimer?: string;
  };
  created_at: string;
};

const HAIR = "border-white/[0.06]";
const PANEL = `rounded-lg border ${HAIR} bg-[#101012]`;
const LABEL = "text-[10px] font-medium uppercase tracking-[0.14em] text-zinc-500";
const BTN =
  "rounded-md border border-white/[0.1] bg-white/[0.04] px-3.5 py-2 text-[12.5px] font-medium text-zinc-100 hover:bg-white/[0.08] disabled:opacity-40";

const JURISDICTIONS = ["New York", "New Jersey", "California", "Texas", "Florida", "Federal (U.S.)"];

export default function Research() {
  const [memos, setMemos] = useState<Memo[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [question, setQuestion] = useState("");
  const [jurisdiction, setJurisdiction] = useState(JURISDICTIONS[0]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function load() {
    const r = await fetch("/api/agent/research", { cache: "no-store" });
    const d = await r.json();
    if (d.memos) setMemos(d.memos);
  }
  useEffect(() => {
    load();
  }, []);

  async function run() {
    if (!question.trim() || busy) return;
    setBusy(true);
    setErr(null);
    try {
      const r = await fetch("/api/agent/research", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ question, jurisdiction })
      });
      const d = await r.json();
      if (!r.ok || d.error) setErr(d.error || "research failed");
      else {
        setQuestion("");
        await load();
        setSelected(d.memoId);
      }
    } catch {
      setErr("network error");
    }
    setBusy(false);
  }

  const memo = memos.find((m) => m.id === selected) || null;

  return (
    <Shell active="Research">
      <header className="sticky top-0 z-10 border-b border-white/[0.06] bg-[#0a0a0b]/90 backdrop-blur">
        <div className="px-6 py-3">
          <h1 className="text-[14px] font-semibold tracking-tight">Legal Research</h1>
          <p className="text-[10.5px] text-zinc-500">AI first-pass memos — attorney verification required</p>
        </div>
      </header>

      <main className="space-y-4 px-6 py-5">
        {/* ask */}
        <div className={`${PANEL} p-5`}>
          <p className={`${LABEL} mb-3`}>Research Agent — new question</p>
          <div className="flex flex-col gap-2.5 md:flex-row">
            <input
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && run()}
              placeholder="e.g. Is a dog owner strictly liable for bite injuries, and what damages are recoverable?"
              className="flex-1 rounded-md border border-white/[0.08] bg-black/30 px-3.5 py-2.5 text-[13px] outline-none focus:border-sky-400/50"
            />
            <select
              value={jurisdiction}
              onChange={(e) => setJurisdiction(e.target.value)}
              className="rounded-md border border-white/[0.1] bg-[#0a0a0b] px-3 py-2 text-[12.5px] outline-none focus:border-sky-400/50"
            >
              {JURISDICTIONS.map((j) => (
                <option key={j}>{j}</option>
              ))}
            </select>
            <button onClick={run} disabled={busy || !question.trim()} className={BTN}>
              {busy ? "Researching… (~30s)" : "Run research"}
            </button>
          </div>
          {err && <p className="mt-2 text-[12px] text-red-300">⚠ {err}</p>}
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[320px_1fr]">
          {/* memo list */}
          <div className={PANEL}>
            <div className={`border-b ${HAIR} px-5 py-3.5`}>
              <p className={LABEL}>Memos</p>
            </div>
            <div className="divide-y divide-white/[0.04]">
              {memos.length === 0 && <p className="px-5 py-6 text-[13px] text-zinc-500">No memos yet.</p>}
              {memos.map((m) => (
                <button
                  key={m.id}
                  onClick={() => setSelected(m.id)}
                  className={`block w-full px-5 py-3 text-left hover:bg-white/[0.03] ${selected === m.id ? "bg-white/[0.05]" : ""}`}
                >
                  <p className="line-clamp-2 text-[12.5px] text-zinc-200">{m.question}</p>
                  <p className="mt-1 text-[10.5px] text-zinc-500">
                    {m.jurisdiction} ·{" "}
                    {new Date(m.created_at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                  </p>
                </button>
              ))}
            </div>
          </div>

          {/* memo viewer */}
          <div className="space-y-4">
            {!memo && <div className={`${PANEL} p-8 text-center text-[13px] text-zinc-500`}>Select or run a memo.</div>}
            {memo && (
              <div className={`${PANEL} p-6`}>
                <p className="rounded-md border border-amber-400/25 bg-amber-400/[0.07] px-3.5 py-2.5 text-[11.5px] leading-relaxed text-amber-200/90">
                  {memo.memo.disclaimer ||
                    "AI-generated first-pass research. All citations must be independently verified by a licensed attorney before reliance or filing."}
                </p>

                <div className="mt-5 space-y-5 text-[13px] leading-relaxed">
                  <section>
                    <p className={LABEL}>Issue</p>
                    <p className="mt-1.5 text-zinc-200">{memo.memo.issue}</p>
                  </section>
                  <section>
                    <p className={LABEL}>Short answer</p>
                    <p className="mt-1.5 text-zinc-200">{memo.memo.short_answer}</p>
                  </section>
                  <section>
                    <p className={LABEL}>Analysis</p>
                    <p className="mt-1.5 whitespace-pre-wrap text-zinc-300">{memo.memo.analysis}</p>
                  </section>

                  {memo.memo.authorities && memo.memo.authorities.length > 0 && (
                    <section>
                      <p className={LABEL}>Authorities — verification status</p>
                      <div className="mt-2 divide-y divide-white/[0.04] rounded-md border border-white/[0.06]">
                        {memo.memo.authorities.map((a, i) => (
                          <div key={i} className="flex items-start gap-3 px-3.5 py-2.5">
                            <span className="mt-0.5 rounded bg-red-400/10 px-1.5 py-0.5 text-[9px] font-bold text-red-300">
                              UNVERIFIED
                            </span>
                            <div>
                              <p className="text-[12.5px] font-medium text-zinc-200">{a.citation}</p>
                              <p className="text-[11.5px] text-zinc-500">{a.relevance}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </section>
                  )}

                  {memo.memo.caveats && memo.memo.caveats.length > 0 && (
                    <section>
                      <p className={LABEL}>Caveats</p>
                      <ul className="mt-1.5 list-disc space-y-1 pl-5 text-zinc-400">
                        {memo.memo.caveats.map((c, i) => (
                          <li key={i}>{c}</li>
                        ))}
                      </ul>
                    </section>
                  )}

                  {memo.memo.citation_checklist && (
                    <section>
                      <p className={LABEL}>Attorney verification checklist</p>
                      <ul className="mt-1.5 space-y-1.5">
                        {memo.memo.citation_checklist.map((c, i) => (
                          <li key={i} className="flex items-start gap-2.5 text-zinc-400">
                            <span className="mt-0.5 inline-block h-3.5 w-3.5 flex-shrink-0 rounded border border-white/20" />
                            {c}
                          </li>
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
