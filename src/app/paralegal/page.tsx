"use client";

// Paralegal workspace: pick a matter → record consultation notes (AI note-taker)
// → generate USCIS Form G-28 (paralegal agent) → download the filled PDF.
import { useEffect, useState } from "react";
import Shell from "@/components/Shell";

type Doc = { id: string; type: string; filename: string; status: string; created_at: string };
type Matter = {
  id: string;
  name: string | null;
  phone: string | null;
  email: string | null;
  case_type: string | null;
  case_summary: string | null;
  urgency: string | null;
  qualification_status: string;
  source: string;
  note_count: string;
  documents: Doc[];
  latest_note: Record<string, unknown> | null;
};

const HAIR = "border-white/[0.06]";
const PANEL = `rounded-lg border ${HAIR} bg-[#101012]`;
const LABEL = "text-[10px] font-medium uppercase tracking-[0.14em] text-zinc-500";
const BTN =
  "rounded-md border border-white/[0.1] bg-white/[0.04] px-3.5 py-2 text-[12.5px] font-medium text-zinc-100 hover:bg-white/[0.08] disabled:opacity-40";

export default function Paralegal() {
  const [matters, setMatters] = useState<Matter[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [transcript, setTranscript] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  async function load() {
    const r = await fetch("/api/matters", { cache: "no-store" });
    const d = await r.json();
    if (d.matters) setMatters(d.matters);
  }
  useEffect(() => {
    load();
  }, []);

  const matter = matters.find((m) => m.id === selected) || null;

  async function recordNotes() {
    if (!matter || !transcript.trim()) return;
    setBusy("notes");
    setMsg(null);
    try {
      const r = await fetch("/api/agent/notetaker", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ leadId: matter.id, transcript })
      });
      const d = await r.json();
      if (!r.ok || d.error) setMsg("Note-taker error: " + (d.error || r.status));
      else {
        setMsg("Consultation notes recorded.");
        setTranscript("");
        await load();
      }
    } catch {
      setMsg("Network error");
    }
    setBusy(null);
  }

  async function generateG28() {
    if (!matter) return;
    setBusy("g28");
    setMsg(null);
    try {
      const r = await fetch("/api/agent/paralegal", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ leadId: matter.id })
      });
      const d = await r.json();
      if (!r.ok || d.error) setMsg("Paralegal agent error: " + (d.error || r.status));
      else {
        setMsg(
          d.missing_for_filing?.length
            ? "G-28 drafted. Still needed before filing: " + d.missing_for_filing.join(", ")
            : "G-28 drafted — ready for attorney review."
        );
        await load();
      }
    } catch {
      setMsg("Network error");
    }
    setBusy(null);
  }

  const note = matter?.latest_note as Record<string, any> | null;

  return (
    <Shell active="Paralegal">
      <header className="sticky top-0 z-10 border-b border-white/[0.06] bg-[#0a0a0b]/90 backdrop-blur">
        <div className="flex items-center justify-between px-6 py-3">
          <div>
            <h1 className="text-[14px] font-semibold tracking-tight">Paralegal Workspace</h1>
            <p className="text-[10.5px] text-zinc-500">Consultation notes & USCIS form preparation</p>
          </div>
        </div>
      </header>

      <main className="grid grid-cols-1 gap-4 px-6 py-5 lg:grid-cols-[320px_1fr]">
        {/* matters list */}
        <div className={PANEL}>
          <div className={`border-b ${HAIR} px-5 py-3.5`}>
            <p className={LABEL}>Matters</p>
          </div>
          <div className="divide-y divide-white/[0.04]">
            {matters.map((m) => (
              <button
                key={m.id}
                onClick={() => { setSelected(m.id); setMsg(null); }}
                className={`block w-full px-5 py-3 text-left hover:bg-white/[0.03] ${selected === m.id ? "bg-white/[0.05]" : ""}`}
              >
                <div className="flex items-center justify-between">
                  <p className="text-[13px] font-medium">{m.name || "Anonymous"}</p>
                  <span className="rounded bg-sky-400/10 px-1.5 py-0.5 text-[9.5px] font-semibold uppercase text-sky-300">
                    {m.source}
                  </span>
                </div>
                <p className="mt-0.5 text-[11px] text-zinc-500">
                  {m.case_type || "unclassified"} · {m.qualification_status} · {m.note_count} notes ·{" "}
                  {(m.documents || []).length} docs
                </p>
              </button>
            ))}
            {matters.length === 0 && <p className="px-5 py-6 text-[13px] text-zinc-500">No matters yet.</p>}
          </div>
        </div>

        {/* detail */}
        <div className="space-y-4">
          {!matter && <div className={`${PANEL} p-8 text-center text-[13px] text-zinc-500`}>Select a matter.</div>}
          {matter && (
            <>
              <div className={`${PANEL} p-5`}>
                <div className="flex items-baseline justify-between">
                  <p className="text-[15px] font-semibold">{matter.name || "Anonymous"}</p>
                  <p className="text-[11px] text-zinc-500">
                    {matter.phone || "no phone"} · {matter.email || "no email"}
                  </p>
                </div>
                <p className="mt-2 text-[12.5px] leading-relaxed text-zinc-400">{matter.case_summary}</p>
              </div>

              {/* note-taker */}
              <div className={`${PANEL} p-5`}>
                <p className={`${LABEL} mb-3`}>AI Note-Taker — consultation transcript</p>
                {note && (
                  <div className={`mb-4 rounded-md border ${HAIR} bg-black/30 p-4 text-[12.5px] leading-relaxed`}>
                    <p className="text-zinc-300">{String(note.summary || "")}</p>
                    {Array.isArray(note.forms_needed) && note.forms_needed.length > 0 && (
                      <p className="mt-2 text-zinc-500">
                        Forms needed: <span className="text-amber-300">{note.forms_needed.join(", ")}</span>
                      </p>
                    )}
                    {Array.isArray(note.action_items) && note.action_items.length > 0 && (
                      <ul className="mt-2 space-y-1 text-zinc-400">
                        {note.action_items.slice(0, 5).map((a: any, i: number) => (
                          <li key={i}>· {a.owner}: {a.task}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
                <textarea
                  value={transcript}
                  onChange={(e) => setTranscript(e.target.value)}
                  rows={5}
                  placeholder="Paste the consultation conversation/transcript here…"
                  className="w-full rounded-md border border-white/[0.08] bg-black/30 p-3 text-[12.5px] leading-relaxed outline-none focus:border-sky-400/50"
                />
                <button onClick={recordNotes} disabled={busy !== null || !transcript.trim()} className={`${BTN} mt-3`}>
                  {busy === "notes" ? "Structuring notes…" : "Record case notes"}
                </button>
              </div>

              {/* paralegal form agent */}
              <div className={`${PANEL} p-5`}>
                <p className={`${LABEL} mb-3`}>Paralegal Agent — USCIS Form G-28</p>
                <p className="mb-3 text-[12px] text-zinc-500">
                  Fills the official Form G-28 (Notice of Entry of Appearance) from the intake record and consultation
                  notes. Output is a draft for attorney review — signatures are left blank.
                </p>
                <button onClick={generateG28} disabled={busy !== null} className={BTN}>
                  {busy === "g28" ? "Preparing form…" : "Prepare Form G-28"}
                </button>
                {(matter.documents || []).length > 0 && (
                  <div className="mt-4 divide-y divide-white/[0.04]">
                    {matter.documents.map((d) => (
                      <div key={d.id} className="flex items-center justify-between py-2.5 text-[12.5px]">
                        <span className="text-zinc-300">
                          {d.filename}{" "}
                          <span className="ml-2 rounded bg-amber-400/10 px-1.5 py-0.5 text-[9.5px] font-semibold uppercase text-amber-300">
                            {d.status}
                          </span>
                        </span>
                        <a href={`/api/documents/${d.id}`} target="_blank" className="text-sky-300 hover:underline">
                          Open PDF ↗
                        </a>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {msg && (
                <div className={`${PANEL} px-5 py-3 text-[12.5px] text-emerald-300`}>{msg}</div>
              )}
            </>
          )}
        </div>
      </main>
    </Shell>
  );
}
