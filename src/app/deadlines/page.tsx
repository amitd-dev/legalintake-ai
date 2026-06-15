"use client";

// Deadlines workspace: the Deadline Agent computes statute-of-limitations and
// procedural deadlines from a trigger date and tracks them with escalating alerts.
// AI first-pass — every date must be verified by an attorney.
import { useEffect, useState } from "react";
import Shell from "@/components/Shell";

type Deadline = {
  id: string;
  matter: string;
  type: string;
  jurisdiction: string;
  due_date: string;
  basis: string;
  alert_level: "normal" | "upcoming" | "urgent" | "overdue";
  days_remaining: number;
};

const HAIR = "border-white/[0.06]";
const PANEL = `rounded-lg border ${HAIR} bg-[#101012]`;
const LABEL = "text-[10px] font-medium uppercase tracking-[0.14em] text-zinc-500";
const BTN =
  "rounded-md border border-white/[0.1] bg-white/[0.04] px-3.5 py-2 text-[12.5px] font-medium text-zinc-100 hover:bg-white/[0.08] disabled:opacity-40";

const JURISDICTIONS = ["New York", "New Jersey", "California", "Texas", "Florida", "Federal (U.S.)"];

const ALERT: Record<Deadline["alert_level"], { cls: string; label: string }> = {
  overdue: { cls: "bg-red-500/15 text-red-300 border-red-500/30", label: "OVERDUE" },
  urgent: { cls: "bg-red-400/10 text-red-300 border-red-400/25", label: "URGENT" },
  upcoming: { cls: "bg-amber-400/10 text-amber-300 border-amber-400/25", label: "UPCOMING" },
  normal: { cls: "bg-emerald-400/10 text-emerald-300 border-emerald-400/20", label: "ON TRACK" }
};

export default function Deadlines() {
  const [deadlines, setDeadlines] = useState<Deadline[]>([]);
  const [caseType, setCaseType] = useState("");
  const [jurisdiction, setJurisdiction] = useState(JURISDICTIONS[0]);
  const [triggerDate, setTriggerDate] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function load() {
    const r = await fetch("/api/agent/deadline", { cache: "no-store" });
    const d = await r.json();
    if (d.deadlines) setDeadlines(d.deadlines);
  }
  useEffect(() => {
    load();
  }, []);

  async function run() {
    if (!caseType.trim() || !triggerDate.trim() || busy) return;
    setBusy(true);
    setErr(null);
    try {
      const r = await fetch("/api/agent/deadline", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ caseType, jurisdiction, triggerDate, matter: caseType })
      });
      const d = await r.json();
      if (!r.ok || d.error) setErr(d.error || "deadline computation failed");
      else {
        setCaseType("");
        setTriggerDate("");
        await load();
      }
    } catch {
      setErr("network error");
    }
    setBusy(false);
  }

  return (
    <Shell active="Deadlines">
      <header className="sticky top-0 z-10 border-b border-white/[0.06] bg-[#0a0a0b]/90 backdrop-blur">
        <div className="px-6 py-3">
          <h1 className="text-[14px] font-semibold tracking-tight">Deadlines</h1>
          <p className="text-[10.5px] text-zinc-500">SOL &amp; procedural tracking — attorney verification required</p>
        </div>
      </header>

      <main className="space-y-4 px-6 py-5">
        <div className={`${PANEL} p-5`}>
          <p className={`${LABEL} mb-3`}>Deadline Agent — compute deadlines from a trigger date</p>
          <div className="flex flex-col gap-2.5 md:flex-row">
            <input
              value={caseType}
              onChange={(e) => setCaseType(e.target.value)}
              placeholder="Case type — e.g. personal injury (slip and fall)"
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
            <input
              type="date"
              value={triggerDate}
              onChange={(e) => setTriggerDate(e.target.value)}
              className="rounded-md border border-white/[0.1] bg-[#0a0a0b] px-3 py-2 text-[12.5px] text-zinc-300 outline-none focus:border-sky-400/50"
            />
            <button onClick={run} disabled={busy || !caseType.trim() || !triggerDate.trim()} className={BTN}>
              {busy ? "Computing…" : "Compute deadlines"}
            </button>
          </div>
          <p className="mt-2 text-[10.5px] text-zinc-600">Trigger date = date of injury, service of process, or other limitations-starting event.</p>
          {err && <p className="mt-2 text-[12px] text-red-300">⚠ {err}</p>}
        </div>

        <div className={PANEL}>
          <div className={`flex items-baseline justify-between border-b ${HAIR} px-5 py-3.5`}>
            <p className={LABEL}>Tracked deadlines</p>
            <p className="text-[11px] text-zinc-500">soonest first · alerts auto-escalate daily</p>
          </div>
          {deadlines.length === 0 ? (
            <p className="px-5 py-6 text-[13px] text-zinc-500">No deadlines tracked yet.</p>
          ) : (
            <div className="divide-y divide-white/[0.04]">
              {deadlines.map((d) => {
                const a = ALERT[d.alert_level];
                return (
                  <div key={d.id} className="flex items-start gap-4 px-5 py-3.5">
                    <span className={`mt-0.5 flex-shrink-0 rounded border px-1.5 py-0.5 text-[9px] font-bold tracking-wide ${a.cls}`}>
                      {a.label}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-medium text-zinc-100">{d.type}</p>
                      <p className="text-[11.5px] text-zinc-500">{d.matter} · {d.jurisdiction}</p>
                      <p className="mt-1 text-[11.5px] text-zinc-400">{d.basis}</p>
                    </div>
                    <div className="flex-shrink-0 text-right">
                      <p className="tnum text-[13px] font-semibold text-zinc-100">{d.due_date}</p>
                      <p className={`tnum text-[11px] ${d.days_remaining < 0 ? "text-red-300" : d.days_remaining <= 14 ? "text-red-300" : d.days_remaining <= 45 ? "text-amber-300" : "text-zinc-500"}`}>
                        {d.days_remaining < 0 ? `${Math.abs(d.days_remaining)}d overdue` : `${d.days_remaining}d left`}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <p className="rounded-md border border-amber-400/25 bg-amber-400/[0.07] px-3.5 py-2.5 text-[11.5px] leading-relaxed text-amber-200/90">
          AI-computed dates are a first pass only. Every deadline — especially the statute of limitations — must be independently verified by a licensed attorney against the controlling rules and any tolling before being relied upon.
        </p>
      </main>
    </Shell>
  );
}
