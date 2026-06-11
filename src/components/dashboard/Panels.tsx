"use client";

import { useEffect, useRef, useState } from "react";
import type { DashboardData } from "./useDashboardData";

const money = (v: string | number) =>
  "$" + Number(v).toLocaleString("en-US", { maximumFractionDigits: 0 });

/* ---------- KPI cards ---------- */
function Kpi({ label, value, gold = false }: { label: string; value: string; gold?: boolean }) {
  const prev = useRef(value);
  const [flash, setFlash] = useState(false);
  useEffect(() => {
    if (prev.current !== value) {
      prev.current = value;
      setFlash(true);
      const t = setTimeout(() => setFlash(false), 1200);
      return () => clearTimeout(t);
    }
  }, [value]);
  return (
    <div
      className={`rounded-xl border bg-panel p-5 transition-all duration-500 ${
        flash ? "border-mint shadow-[0_0_24px_rgba(52,211,153,0.25)]" : "border-edge"
      }`}
    >
      <p className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-fog">{label}</p>
      <p className={`tnum mt-2 text-3xl font-extrabold ${gold ? "text-gold" : ""}`}>{value}</p>
    </div>
  );
}

export function KpiCards({ kpis }: { kpis: DashboardData["kpis"] }) {
  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      <Kpi label="Leads Today" value={kpis.leads_today} />
      <Kpi label="Qualified" value={kpis.qualified_today} />
      <Kpi label="Consultations Booked" value={kpis.booked_today} />
      <Kpi label="Pipeline Value" value={money(kpis.pipeline_value)} gold />
    </div>
  );
}

/* ---------- funnel ---------- */
const STAGES: { key: keyof DashboardData["funnel"]; label: string; color: string }[] = [
  { key: "inquiries", label: "Inquiries", color: "bg-[#a78bfa]" },
  { key: "qualified", label: "Qualified", color: "bg-sky" },
  { key: "booked", label: "Booked", color: "bg-amber" },
  { key: "showed", label: "Showed", color: "bg-mint" }
];

export function PipelineFunnel({ funnel }: { funnel: DashboardData["funnel"] }) {
  const max = Math.max(1, ...STAGES.map((s) => Number(funnel[s.key])));
  return (
    <div className="rounded-xl border border-edge bg-panel p-5">
      <p className="mb-4 text-[10.5px] font-semibold uppercase tracking-[0.16em] text-fog">Pipeline Funnel</p>
      <div className="space-y-4">
        {STAGES.map((s) => (
          <div key={s.key}>
            <div className="mb-1.5 flex justify-between text-xs">
              <span className="text-slate-300">{s.label}</span>
              <span className="tnum font-bold">{funnel[s.key]}</span>
            </div>
            <div className="h-5 overflow-hidden rounded-md bg-panel-2">
              <div
                className={`h-full rounded-md ${s.color} transition-all duration-700`}
                style={{ width: `${(Number(funnel[s.key]) / max) * 100}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------- activity feed ---------- */
function eventLine(type: string, p: Record<string, unknown>): { icon: string; text: string; highlight: boolean } {
  switch (type) {
    case "lead_qualified":
      return {
        icon: "✓",
        text: `Qualified lead — ${p.name ?? "unknown"} · ${p.case_type ?? "?"}${
          p.estimated_value ? ` · est. ${money(p.estimated_value as number)}` : ""
        }`,
        highlight: true
      };
    case "lead_captured":
      return { icon: "+", text: `New lead — ${p.name ?? "unknown"} · ${p.case_type ?? "general inquiry"}`, highlight: false };
    case "booking_created":
      return { icon: "📅", text: `Consultation booked — ${p.attorney ?? ""} ${p.slot ?? ""}`, highlight: true };
    case "escalation":
      return { icon: "⚠", text: `Escalated to human — ${p.reason ?? ""}`, highlight: true };
    case "conversation_started":
      return { icon: "💬", text: `New ${p.channel ?? "web"} conversation started`, highlight: false };
    default:
      return { icon: "·", text: type.replaceAll("_", " "), highlight: false };
  }
}

export function ActivityFeed({ events }: { events: DashboardData["events"] }) {
  return (
    <div className="flex min-h-0 flex-col rounded-xl border border-edge bg-panel p-5">
      <p className="mb-4 text-[10.5px] font-semibold uppercase tracking-[0.16em] text-fog">Live Activity</p>
      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto">
        {events.length === 0 && <p className="text-sm text-fog">Waiting for activity…</p>}
        {events.map((e) => {
          const line = eventLine(e.type, e.payload);
          return (
            <div
              key={e.id}
              className={`flex items-start gap-3 rounded-lg border px-3 py-2 text-[12.5px] leading-relaxed ${
                line.highlight ? "border-mint/30 bg-mint/5" : "border-transparent bg-panel-2"
              }`}
            >
              <span className="mt-0.5 w-4 text-center">{line.icon}</span>
              <div className="min-w-0 flex-1">
                <p className="truncate">{line.text}</p>
                <p className="text-[10px] text-fog">
                  {new Date(e.created_at).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ---------- conversations ---------- */
export function ConversationsList({ conversations }: { conversations: DashboardData["conversations"] }) {
  return (
    <div className="rounded-xl border border-edge bg-panel p-5">
      <p className="mb-4 text-[10.5px] font-semibold uppercase tracking-[0.16em] text-fog">Conversations</p>
      <div className="space-y-2">
        {conversations.length === 0 && <p className="text-sm text-fog">No conversations yet.</p>}
        {conversations.map((c) => (
          <div key={c.id} className="flex items-center gap-3 rounded-lg bg-panel-2 px-3 py-2.5 text-[12.5px]">
            <span
              className={`h-2 w-2 flex-shrink-0 rounded-full ${
                c.escalated ? "bg-red-400" : c.status === "active" ? "bg-mint animate-pulse" : "bg-fog"
              }`}
            />
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{c.lead_name || "Anonymous visitor"}</p>
              <p className="truncate text-[10.5px] text-fog">
                {c.case_type || "qualifying…"} · {c.message_count} messages
              </p>
            </div>
            {c.escalated && (
              <span className="rounded-full bg-red-400/10 px-2 py-0.5 text-[10px] font-bold text-red-300">HUMAN</span>
            )}
            <span className="tnum text-[10.5px] text-fog">
              {new Date(c.started_at).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
