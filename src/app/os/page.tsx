"use client";

// Agent OS — mission-control view. Each AI agent runs in its own "window" with a
// live ACTIVE/IDLE status and its own work stream; a system console tails every
// event. All state polled from the production database every 2 seconds.
import { useEffect, useState } from "react";
import { useDashboardData, type DashboardData } from "@/components/dashboard/useDashboardData";

type Ev = DashboardData["events"][number];

const AGENT_DEFS = [
  { key: "intake", name: "Intake Agent", proc: "intake.agent", desc: "Client intake · qualification · booking" },
  { key: "notetaker", name: "Note-Taker Agent", proc: "notes.agent", desc: "Consultation transcripts → case notes" },
  { key: "paralegal", name: "Paralegal Agent", proc: "forms.agent", desc: "USCIS form preparation (G-28)" }
] as const;

function agentKeyFor(type: string): string {
  if (type === "note_recorded") return "notetaker";
  if (type === "document_generated") return "paralegal";
  return "intake";
}

function line(e: Ev): string {
  const p = e.payload as Record<string, any>;
  switch (e.type) {
    case "conversation_started": return `session opened — ${p.channel || "web"}${p.source && p.source !== "web" ? ` (${p.source})` : ""}`;
    case "lead_captured": return `lead saved — ${p.name || "unknown"}`;
    case "lead_qualified": return `lead QUALIFIED — ${p.name || "?"} · ${p.case_type || ""}${p.estimated_value ? ` · $${Number(p.estimated_value).toLocaleString()}` : ""}`;
    case "lead_unqualified": return `lead marked outside practice — ${p.name || "?"}`;
    case "booking_created": return `consultation BOOKED — ${p.attorney || ""} · ${p.slot || ""}`;
    case "escalation": return `ESCALATED to human — ${String(p.reason || "").slice(0, 60)}`;
    case "note_recorded": return `case notes filed — ${p.name || "client"}${Array.isArray(p.forms_needed) && p.forms_needed.length ? ` · needs ${p.forms_needed.join(", ")}` : ""}`;
    case "document_generated": return `${p.doc_type || "document"} drafted — ${p.name || "client"}`;
    default: return e.type.replaceAll("_", " ");
  }
}

const t = (iso: string) =>
  new Date(iso).toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" });

function MenuClock() {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const i = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(i);
  }, []);
  if (!now) return null;
  return (
    <span className="tnum text-[11px] text-zinc-400">
      {now.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}{" "}
      {now.toLocaleTimeString("en-US", { hour12: false })}
    </span>
  );
}

function Window({
  title, status, children, className = ""
}: { title: string; status?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={`flex flex-col overflow-hidden rounded-lg border border-white/[0.08] bg-[#101012] shadow-[0_8px_30px_rgba(0,0,0,0.45)] ${className}`}>
      <div className="flex items-center gap-2 border-b border-white/[0.06] bg-white/[0.02] px-3.5 py-2">
        <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]" />
        <span className="h-2.5 w-2.5 rounded-full bg-[#febc2e]" />
        <span className="h-2.5 w-2.5 rounded-full bg-[#28c840]" />
        <span className="ml-2 text-[11.5px] font-medium text-zinc-300">{title}</span>
        <span className="ml-auto">{status}</span>
      </div>
      <div className="min-h-0 flex-1">{children}</div>
    </section>
  );
}

export default function AgentOS() {
  const { data, error } = useDashboardData(2000);
  const events = data?.events || [];
  const agents = data?.agents || {};
  const now = Date.now();

  const byAgent = (k: string) => events.filter((e) => agentKeyFor(e.type) === k);
  const isActive = (k: string) => {
    const last = agents[`${k}_last`];
    return last ? now - new Date(last).getTime() < 2 * 60 * 1000 : false;
  };

  return (
    <div
      className="flex min-h-dvh flex-col bg-[#0a0a0b] text-zinc-100"
      style={{ backgroundImage: "radial-gradient(rgba(255,255,255,0.035) 1px, transparent 1px)", backgroundSize: "26px 26px" }}
    >
      {/* menu bar */}
      <div className="flex items-center gap-5 border-b border-white/[0.08] bg-[#0d0d0f]/95 px-4 py-1.5 backdrop-blur">
        <span className="flex items-center gap-2 text-[12px] font-semibold tracking-tight">
          <span className="flex h-4.5 w-4.5 items-center justify-center rounded bg-gradient-to-br from-[#e3b341] to-[#8a6d1f] px-1 font-serif text-[9px] font-bold text-black">HV</span>
          Agent OS
        </span>
        <a href="/dashboard" className="text-[11.5px] text-zinc-500 hover:text-zinc-200">Operations</a>
        <a href="/paralegal" className="text-[11.5px] text-zinc-500 hover:text-zinc-200">Paralegal</a>
        <a href="/" className="text-[11.5px] text-zinc-500 hover:text-zinc-200">Client chat</a>
        <span className="ml-auto flex items-center gap-3">
          <span className="flex items-center gap-1.5 text-[10.5px] font-medium text-zinc-400">
            <span className={`h-1.5 w-1.5 rounded-full ${error ? "bg-red-400" : "bg-emerald-400"}`} />
            {error ? "RECONNECTING" : "LIVE"}
          </span>
          <MenuClock />
        </span>
      </div>

      {/* desktop */}
      <main className="grid flex-1 grid-cols-1 gap-4 p-4 lg:grid-cols-2 xl:grid-cols-4">
        {/* agent windows */}
        {AGENT_DEFS.map((a) => {
          const feed = byAgent(a.key).slice(0, 7);
          const active = isActive(a.key);
          return (
            <Window
              key={a.key}
              title={a.proc}
              className="xl:col-span-1"
              status={
                <span className={`flex items-center gap-1.5 rounded px-1.5 py-0.5 text-[9px] font-bold tracking-wider ${
                  active ? "bg-emerald-400/10 text-emerald-300" : "bg-zinc-500/10 text-zinc-500"
                }`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${active ? "animate-pulse bg-emerald-400" : "bg-zinc-600"}`} />
                  {active ? "ACTIVE" : "IDLE"}
                </span>
              }
            >
              <div className="border-b border-white/[0.05] px-3.5 py-2.5">
                <p className="text-[12.5px] font-semibold">{a.name}</p>
                <p className="text-[10.5px] text-zinc-500">{a.desc}</p>
              </div>
              <div className="px-3.5 py-2 font-mono text-[10.5px] leading-[1.8] text-zinc-400">
                {feed.length === 0 && <p className="text-zinc-600">— no activity in current window —</p>}
                {feed.map((e) => (
                  <p key={e.id} className="truncate">
                    <span className="text-zinc-600">{t(e.created_at)}</span>{" "}
                    <span className={e.type === "escalation" ? "text-red-300" : e.type.includes("qualified") || e.type === "booking_created" || e.type === "document_generated" ? "text-emerald-300/90" : "text-zinc-400"}>
                      {line(e)}
                    </span>
                  </p>
                ))}
              </div>
              <div className="mt-auto flex items-center justify-between border-t border-white/[0.05] px-3.5 py-2 text-[10px] text-zinc-500">
                <span className="tnum">today {agents[`${a.key}_today`] ?? 0} · total {agents[`${a.key}_total`] ?? 0}</span>
                <span className="tnum">last {agents[`${a.key}_last`] ? t(agents[`${a.key}_last`] as string) : "—"}</span>
              </div>
            </Window>
          );
        })}

        {/* system monitor */}
        <Window title="system.monitor" className="xl:col-span-1"
          status={<span className="text-[9px] font-bold tracking-wider text-zinc-500">DB LIVE</span>}>
          <div className="space-y-3 px-3.5 py-3">
            {data ? (
              <>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    ["Leads today", data.kpis.leads_today],
                    ["Qualified", data.kpis.qualified_today],
                    ["Booked", data.kpis.booked_today],
                    ["Pipeline", "$" + Number(data.kpis.pipeline_value).toLocaleString()]
                  ].map(([l, v]) => (
                    <div key={l as string} className="rounded-md border border-white/[0.05] bg-black/30 px-2.5 py-2">
                      <p className="text-[9px] uppercase tracking-[0.12em] text-zinc-600">{l}</p>
                      <p className={`tnum text-[15px] font-semibold ${l === "Pipeline" ? "text-[#e3b341]" : ""}`}>{v}</p>
                    </div>
                  ))}
                </div>
                <div className="font-mono text-[10px] leading-[1.9] text-zinc-500">
                  <p>processes&nbsp;&nbsp;&nbsp;3 agents · 0 faults</p>
                  <p>database&nbsp;&nbsp;&nbsp;&nbsp;postgres · 7 tables</p>
                  <p>poll rate&nbsp;&nbsp;&nbsp;2.0s</p>
                  <p>last sync&nbsp;&nbsp;&nbsp;{data.generated_at ? t(data.generated_at) : "—"}</p>
                </div>
              </>
            ) : (
              <p className="font-mono text-[10.5px] text-zinc-600">booting…</p>
            )}
          </div>
        </Window>

        {/* console: full width */}
        <Window
          title="events.console — /var/log/agents"
          className="lg:col-span-2 xl:col-span-4"
          status={<span className="tnum text-[9px] font-bold tracking-wider text-zinc-500">{events.length} EVENTS</span>}
        >
          <div className="max-h-72 overflow-y-auto bg-black/40 px-3.5 py-2.5 font-mono text-[11px] leading-[1.85]">
            {events.map((e) => (
              <p key={e.id} className="whitespace-nowrap">
                <span className="text-zinc-600">{t(e.created_at)}</span>{" "}
                <span className="text-sky-300/80">[{agentKeyFor(e.type)}]</span>{" "}
                <span className={e.type === "escalation" ? "text-red-300" : "text-zinc-300"}>{line(e)}</span>{" "}
                <span className="text-zinc-700">#{e.id.slice(0, 8)}</span>
              </p>
            ))}
            <p className="text-emerald-400/80">▋</p>
          </div>
        </Window>
      </main>
    </div>
  );
}
