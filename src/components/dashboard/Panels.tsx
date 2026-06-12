"use client";

import { useEffect, useRef, useState } from "react";
import type { DashboardData } from "./useDashboardData";

const money = (v: string | number) =>
  "$" + Number(v).toLocaleString("en-US", { maximumFractionDigits: 0 });

const HAIR = "border-white/[0.06]";
const PANEL = `rounded-lg border ${HAIR} bg-[#101012]`;
const LABEL = "whitespace-nowrap text-[10px] font-medium uppercase tracking-[0.14em] text-zinc-500";

/* ---------- sparkline (real hourly leads) ---------- */
function Sparkline({ series }: { series: number[] }) {
  const w = 120, h = 32;
  const max = Math.max(1, ...series);
  const pts = series
    .map((v, i) => `${(i / (series.length - 1)) * w},${h - 3 - (v / max) * (h - 8)}`)
    .join(" ");
  return (
    <svg width={w} height={h} className="overflow-visible opacity-90">
      <polyline points={pts} fill="none" stroke="#34d399" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
      {series.length > 0 && (
        <circle
          cx={w}
          cy={h - 3 - (series[series.length - 1] / max) * (h - 8)}
          r="2.5"
          fill="#34d399"
        />
      )}
    </svg>
  );
}

/* ---------- KPI strip: one panel, hairline-divided cells ---------- */
function useFlash(value: string) {
  const prev = useRef(value);
  const [flash, setFlash] = useState(false);
  useEffect(() => {
    if (prev.current !== value) {
      prev.current = value;
      setFlash(true);
      const t = setTimeout(() => setFlash(false), 900);
      return () => clearTimeout(t);
    }
  }, [value]);
  return flash;
}

function Cell({
  label, value, sub, gold = false, children
}: { label: string; value: string; sub?: string; gold?: boolean; children?: React.ReactNode }) {
  const flash = useFlash(value);
  return (
    <div className="relative flex flex-1 items-end justify-between gap-3 px-5 py-4">
      <div>
        <p className={LABEL}>{label}</p>
        <p
          className={`tnum mt-1.5 text-[26px] font-semibold leading-none tracking-tight transition-colors duration-700 ${
            flash ? "text-emerald-300" : gold ? "text-[#e3b341]" : "text-zinc-100"
          }`}
        >
          {value}
        </p>
        {sub && <p className="mt-1 text-[11px] text-zinc-500">{sub}</p>}
      </div>
      {children}
    </div>
  );
}

function delta(today: string, yesterday: string): string {
  const d = Number(today) - Number(yesterday);
  if (d === 0) return "level vs yesterday";
  return `${d > 0 ? "+" : ""}${d} vs yesterday`;
}

export function KpiCards({
  kpis, hourly, yesterday
}: { kpis: DashboardData["kpis"]; hourly: number[]; yesterday: DashboardData["yesterday"] }) {
  return (
    <div className={`${PANEL} flex divide-x divide-white/[0.06]`}>
      <Cell label="Leads today" value={kpis.leads_today} sub={delta(kpis.leads_today, yesterday?.leads_y ?? "0")}>
        <Sparkline series={hourly} />
      </Cell>
      <Cell label="Qualified" value={kpis.qualified_today} sub={delta(kpis.qualified_today, yesterday?.qualified_y ?? "0")} />
      <Cell label="Booked" value={kpis.booked_today} sub={delta(kpis.booked_today, yesterday?.booked_y ?? "0")} />
      <Cell label="Pipeline value" value={money(kpis.pipeline_value)} sub="sum of qualified estimates" gold />
    </div>
  );
}

/* ---------- agent roster: proof of work from the event log ---------- */
const fmtTime = (iso: string | null | undefined) =>
  iso
    ? new Date(iso).toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit" })
    : "—";

export function AgentRoster({ agents }: { agents: Record<string, string | null> }) {
  const rows = [
    { name: "Intake Agent", role: "Client intake, qualification & scheduling", k: "intake" },
    { name: "Note-Taker Agent", role: "Consultation transcripts → case notes", k: "notetaker" },
    { name: "Paralegal Agent", role: "USCIS form preparation (G-28)", k: "paralegal" },
    { name: "Drafting Agent", role: "Demand letters, engagement letters, NDAs", k: "drafting" }
  ];
  return (
    <div className={PANEL}>
      <div className={`flex items-baseline justify-between border-b ${HAIR} px-5 py-3.5`}>
        <p className={LABEL}>AI Staff — activity log</p>
        <p className="text-[11px] text-zinc-500">verified against event records</p>
      </div>
      <table className="w-full text-[12.5px]">
        <thead>
          <tr className="text-left text-[10px] uppercase tracking-[0.12em] text-zinc-500">
            <th className="px-5 py-2 font-medium">Agent</th>
            <th className="py-2 font-medium">Function</th>
            <th className="py-2 text-right font-medium">Today</th>
            <th className="py-2 text-right font-medium">All time</th>
            <th className="px-5 py-2 text-right font-medium">Last action</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/[0.04]">
          {rows.map((r) => {
            const today = Number(agents?.[`${r.k}_today`] ?? 0);
            const total = Number(agents?.[`${r.k}_total`] ?? 0);
            const last = agents?.[`${r.k}_last`];
            return (
              <tr key={r.k}>
                <td className="px-5 py-3">
                  <span className="flex items-center gap-2 font-medium text-zinc-200">
                    <span className={`h-1.5 w-1.5 rounded-full ${total > 0 ? "bg-emerald-400" : "bg-zinc-600"}`} />
                    {r.name}
                  </span>
                </td>
                <td className="py-3 text-zinc-500">{r.role}</td>
                <td className="tnum py-3 text-right font-semibold text-zinc-100">{today}</td>
                <td className="tnum py-3 text-right text-zinc-400">{total}</td>
                <td className="tnum px-5 py-3 text-right text-zinc-500">{fmtTime(last)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/* agent attribution for each log line */
function agentFor(type: string): string {
  if (type === "note_recorded") return "NOTE-TAKER";
  if (type === "document_generated") return "PARALEGAL";
  return "INTAKE";
}

/* ---------- funnel with stage conversion ---------- */
const STAGES: { key: keyof DashboardData["funnel"]; label: string }[] = [
  { key: "inquiries", label: "Inquiries" },
  { key: "qualified", label: "Qualified" },
  { key: "booked", label: "Booked" },
  { key: "showed", label: "Showed" }
];

export function PipelineFunnel({ funnel }: { funnel: DashboardData["funnel"] }) {
  const max = Math.max(1, ...STAGES.map((s) => Number(funnel[s.key])));
  return (
    <div className={`${PANEL} p-5`}>
      <div className="mb-5 flex items-baseline justify-between">
        <p className={LABEL}>Pipeline</p>
        <p className="text-[11px] text-zinc-500">all time</p>
      </div>
      <div className="space-y-[18px]">
        {STAGES.map((s, i) => {
          const v = Number(funnel[s.key]);
          const prev = i > 0 ? Number(funnel[STAGES[i - 1].key]) : null;
          const conv = prev && prev > 0 ? Math.round((v / prev) * 100) : null;
          return (
            <div key={s.key}>
              <div className="mb-1.5 flex items-baseline justify-between">
                <span className="text-[12.5px] text-zinc-300">{s.label}</span>
                <span className="tnum text-[12.5px] font-semibold text-zinc-100">
                  {v}
                  {conv !== null && <span className="ml-2 font-normal text-zinc-500">{conv}%</span>}
                </span>
              </div>
              <div className="h-[3px] overflow-hidden rounded-full bg-white/[0.06]">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-emerald-400/80 to-cyan-400/80 transition-all duration-700"
                  style={{ width: `${(v / max) * 100}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ---------- activity timeline ---------- */
function eventMeta(type: string, p: Record<string, unknown>) {
  switch (type) {
    case "lead_qualified":
      return {
        tag: "QUALIFIED", tagCls: "bg-emerald-400/10 text-emerald-300",
        text: `${p.name ?? "Unknown"} — ${p.case_type ?? "?"}`,
        right: p.estimated_value ? money(p.estimated_value as number) : null
      };
    case "lead_captured":
      return { tag: "LEAD", tagCls: "bg-zinc-400/10 text-zinc-300", text: `${p.name ?? "Unknown"} — ${p.case_type ?? "general"}`, right: null };
    case "booking_created":
      return { tag: "BOOKED", tagCls: "bg-[#e3b341]/10 text-[#e3b341]", text: `${p.attorney ?? ""} · ${p.slot ?? ""}`, right: null };
    case "escalation":
      return { tag: "ESCALATED", tagCls: "bg-red-400/10 text-red-300", text: String(p.reason ?? ""), right: null };
    case "conversation_started":
      return {
        tag: "SESSION", tagCls: "bg-sky-400/10 text-sky-300",
        text: `New ${p.channel ?? "web"} conversation${p.source && p.source !== "web" ? ` — via ${p.source}` : ""}`,
        right: null
      };
    case "note_recorded":
      return { tag: "NOTES", tagCls: "bg-violet-400/10 text-violet-300", text: `Consultation notes — ${p.name ?? "client"}${Array.isArray(p.forms_needed) && p.forms_needed.length ? ` · forms: ${(p.forms_needed as string[]).join(", ")}` : ""}`, right: null };
    case "document_generated":
      return { tag: "DOCUMENT", tagCls: "bg-amber-400/10 text-amber-300", text: `${p.doc_type ?? "Document"} drafted — ${p.name ?? "client"}`, right: null };
    default:
      return { tag: type.slice(0, 9).toUpperCase(), tagCls: "bg-zinc-400/10 text-zinc-400", text: type.replaceAll("_", " "), right: null };
  }
}

export function ActivityFeed({ events }: { events: DashboardData["events"] }) {
  return (
    <div className={`${PANEL} flex min-h-0 flex-col`}>
      <div className={`flex items-baseline justify-between border-b ${HAIR} px-5 py-3.5`}>
        <p className={LABEL}>Activity</p>
        <p className="text-[11px] text-zinc-500">{events.length} recent</p>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-5">
        {events.length === 0 && <p className="py-6 text-[13px] text-zinc-500">No activity yet.</p>}
        <div className={`divide-y divide-white/[0.04]`}>
          {events.map((e) => {
            const m = eventMeta(e.type, e.payload);
            return (
              <div key={e.id} className="flex items-center gap-3 py-3">
                <span className="tnum w-[52px] flex-shrink-0 text-[11px] text-zinc-500">
                  {new Date(e.created_at).toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit" })}
                </span>
                <span className="w-[88px] flex-shrink-0 text-[10px] font-semibold tracking-wide text-zinc-500">
                  {agentFor(e.type)}
                </span>
                <span className={`flex-shrink-0 rounded px-1.5 py-0.5 text-[9.5px] font-semibold tracking-wide ${m.tagCls}`}>
                  {m.tag}
                </span>
                <p className="min-w-0 flex-1 truncate text-[13px] text-zinc-200">{m.text}</p>
                {m.right && <span className="tnum flex-shrink-0 text-[12.5px] font-semibold text-[#e3b341]">{m.right}</span>}
                <span className="tnum hidden flex-shrink-0 text-[10px] text-zinc-600 sm:block">#{e.id.slice(0, 6)}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ---------- conversations ---------- */
export function ConversationsList({ conversations }: { conversations: DashboardData["conversations"] }) {
  return (
    <div className={PANEL}>
      <div className={`flex items-baseline justify-between border-b ${HAIR} px-5 py-3.5`}>
        <p className={LABEL}>Conversations</p>
        <p className="text-[11px] text-zinc-500">latest 10</p>
      </div>
      <div className="divide-y divide-white/[0.04] px-5">
        {conversations.length === 0 && <p className="py-6 text-[13px] text-zinc-500">None yet.</p>}
        {conversations.map((c) => (
          <div key={c.id} className="group flex items-center gap-3 py-3">
            <span
              className={`h-1.5 w-1.5 flex-shrink-0 rounded-full ${
                c.escalated ? "bg-red-400" : c.status === "active" ? "bg-emerald-400" : "bg-zinc-600"
              }`}
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-medium text-zinc-200">{c.lead_name || "Anonymous visitor"}</p>
              <p className="truncate text-[11px] text-zinc-500">
                {c.case_type || "qualifying"} · {c.message_count} msgs
              </p>
            </div>
            {c.escalated && (
              <span className="rounded bg-red-400/10 px-1.5 py-0.5 text-[9.5px] font-semibold text-red-300">HUMAN</span>
            )}
            <span className="tnum text-[11px] text-zinc-500">
              {new Date(c.started_at).toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit" })}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
