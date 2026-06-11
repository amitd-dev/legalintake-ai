"use client";

import { useEffect, useRef, useState } from "react";
import type { DashboardData } from "./useDashboardData";

const money = (v: string | number) =>
  "$" + Number(v).toLocaleString("en-US", { maximumFractionDigits: 0 });

const HAIR = "border-white/[0.06]";
const PANEL = `rounded-lg border ${HAIR} bg-[#101012]`;
const LABEL = "text-[10px] font-medium uppercase tracking-[0.14em] text-zinc-500";

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

export function KpiCards({ kpis, hourly }: { kpis: DashboardData["kpis"]; hourly: number[] }) {
  return (
    <div className={`${PANEL} flex divide-x divide-white/[0.06]`}>
      <Cell label="Leads · today" value={kpis.leads_today} sub="last 12h trend">
        <Sparkline series={hourly} />
      </Cell>
      <Cell label="Qualified" value={kpis.qualified_today} sub="fit + consult-ready" />
      <Cell label="Booked" value={kpis.booked_today} sub="consultations" />
      <Cell label="Pipeline value" value={money(kpis.pipeline_value)} sub="qualified estimate" gold />
    </div>
  );
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
      return { tag: "SESSION", tagCls: "bg-sky-400/10 text-sky-300", text: `New ${p.channel ?? "web"} conversation`, right: null };
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
              <div key={e.id} className="flex items-center gap-3.5 py-3">
                <span className="tnum w-[52px] flex-shrink-0 text-[11px] text-zinc-500">
                  {new Date(e.created_at).toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit" })}
                </span>
                <span className={`flex-shrink-0 rounded px-1.5 py-0.5 text-[9.5px] font-semibold tracking-wide ${m.tagCls}`}>
                  {m.tag}
                </span>
                <p className="min-w-0 flex-1 truncate text-[13px] text-zinc-200">{m.text}</p>
                {m.right && <span className="tnum flex-shrink-0 text-[12.5px] font-semibold text-[#e3b341]">{m.right}</span>}
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
