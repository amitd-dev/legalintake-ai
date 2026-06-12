"use client";

import { useEffect, useState } from "react";
import Shell from "@/components/Shell";
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
    <Shell active="Operations">
      <header className="sticky top-0 z-10 border-b border-white/[0.06] bg-[#0a0a0b]/90 backdrop-blur">
        <div className="flex items-center justify-between px-6 py-3">
          <div>
            <h1 className="text-[14px] font-semibold tracking-tight">Operations</h1>
            <p className="text-[10.5px] text-zinc-500">Live intake, bookings & agent activity</p>
          </div>
          <div className="flex items-center gap-4">
            <Clock />
            <span className="flex items-center gap-1.5 rounded-full border border-white/[0.08] px-2.5 py-1 text-[10.5px] font-medium">
              <span className={`h-1.5 w-1.5 rounded-full ${error ? "bg-red-400" : "bg-emerald-400"}`} />
              {error ? "RECONNECTING" : "LIVE"}
            </span>
          </div>
        </div>
      </header>

      <main className="space-y-4 px-6 py-5">
        {!data && !error && <p className="py-20 text-center text-[13px] text-zinc-500">Connecting to database…</p>}
        {data && (
          <>
            <KpiCards kpis={data.kpis} hourly={data.hourly || []} yesterday={data.yesterday} />
            <AgentRoster agents={data.agents || {}} />
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-[340px_1fr]">
              <div className="space-y-4">
                <PipelineFunnel funnel={data.funnel} />
                <ConversationsList conversations={data.conversations} />
              </div>
              <ActivityFeed events={data.events} />
            </div>
          </>
        )}
      </main>

      <footer className="border-t border-white/[0.06] px-6 py-3">
        <div className="flex items-center justify-between text-[10.5px] text-zinc-600">
          <span>LegalIntake AI · internal operations console</span>
          <span className="tnum">
            data: live production database · refresh 2s
            {data?.generated_at ? ` · last sync ${new Date(data.generated_at).toLocaleTimeString("en-US", { hour12: false })}` : ""}
          </span>
        </div>
      </footer>
    </Shell>
  );
}
