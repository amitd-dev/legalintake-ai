"use client";

import { useEffect, useState } from "react";
import { useDashboardData } from "@/components/dashboard/useDashboardData";
import {
  KpiCards,
  PipelineFunnel,
  ActivityFeed,
  ConversationsList,
  AgentRoster
} from "@/components/dashboard/Panels";

function Clock() {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  if (!now) return null;
  return (
    <span className="tnum text-[11px] text-zinc-500">
      {now.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })} ·{" "}
      {now.toLocaleTimeString("en-US", { hour12: false })}
    </span>
  );
}

export default function Dashboard() {
  const { data, error } = useDashboardData(2000);

  return (
    <div className="flex min-h-dvh flex-col bg-[#0a0a0b] text-zinc-100">
      {/* top bar */}
      <header className="border-b border-white/[0.06] bg-[#0a0a0b]/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-3">
              <div className="flex h-7 w-7 items-center justify-center rounded-md bg-gradient-to-br from-[#e3b341] to-[#8a6d1f] font-serif text-[11px] font-bold text-black">
                HV
              </div>
              <span className="text-[13.5px] font-semibold tracking-tight">Hartwell &amp; Vance</span>
            </div>
            <nav className="flex items-center gap-1 text-[12.5px]">
              <span className="rounded-md bg-white/[0.07] px-3 py-1.5 font-medium text-zinc-100">Operations</span>
              <a href="/paralegal" className="rounded-md px-3 py-1.5 text-zinc-400 hover:bg-white/[0.04] hover:text-zinc-200">
                Paralegal
              </a>
              <a href="/" className="rounded-md px-3 py-1.5 text-zinc-400 hover:bg-white/[0.04] hover:text-zinc-200">
                Client chat
              </a>
            </nav>
          </div>
          <div className="flex items-center gap-4">
            <Clock />
            <span className="rounded border border-white/[0.08] px-2 py-0.5 text-[10px] font-medium text-zinc-500">
              PRODUCTION
            </span>
            <span className="flex items-center gap-1.5 rounded-full border border-white/[0.08] px-2.5 py-1 text-[10.5px] font-medium">
              <span className={`h-1.5 w-1.5 rounded-full ${error ? "bg-red-400" : "bg-emerald-400"}`} />
              {error ? "RECONNECTING" : "LIVE"}
            </span>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 space-y-4 px-6 py-5">
        {!data && !error && <p className="py-20 text-center text-[13px] text-zinc-500">Connecting to database…</p>}
        {data && (
          <>
            <KpiCards kpis={data.kpis} hourly={data.hourly || []} yesterday={data.yesterday} />
            <AgentRoster agents={data.agents || {}} />
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-[340px_1fr]">
              <div className="space-y-4">
                <PipelineFunnel funnel={data.funnel} />
                <ConversationsList conversations={data.conversations} />
              </div>
              <ActivityFeed events={data.events} />
            </div>
          </>
        )}
      </main>

      <footer className="border-t border-white/[0.06]">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3 text-[10.5px] text-zinc-600">
          <span>LegalIntake AI · internal operations console</span>
          <span className="tnum">
            data: live production database · refresh 2s
            {data?.generated_at ? ` · last sync ${new Date(data.generated_at).toLocaleTimeString("en-US", { hour12: false })}` : ""}
          </span>
        </div>
      </footer>
    </div>
  );
}
