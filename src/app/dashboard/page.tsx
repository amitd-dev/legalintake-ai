"use client";

import { useEffect, useState } from "react";
import { useDashboardData } from "@/components/dashboard/useDashboardData";
import { KpiCards, PipelineFunnel, ActivityFeed, ConversationsList } from "@/components/dashboard/Panels";

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
    <div className="min-h-dvh bg-[#0a0a0b] text-zinc-100">
      {/* top bar */}
      <header className="border-b border-white/[0.06] bg-[#0a0a0b]/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3.5">
          <div className="flex items-center gap-3">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-gradient-to-br from-[#e3b341] to-[#8a6d1f] font-serif text-[11px] font-bold text-black">
              HV
            </div>
            <div className="flex items-baseline gap-2.5">
              <span className="text-[13.5px] font-semibold tracking-tight">Hartwell &amp; Vance</span>
              <span className="text-[13.5px] text-zinc-500">Operations</span>
            </div>
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

      <main className="mx-auto max-w-6xl space-y-4 px-6 py-5">
        {!data && !error && <p className="py-20 text-center text-[13px] text-zinc-500">Connecting to database…</p>}
        {data && (
          <>
            <KpiCards kpis={data.kpis} hourly={data.hourly || []} />
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
    </div>
  );
}
