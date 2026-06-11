"use client";

import { useDashboardData } from "@/components/dashboard/useDashboardData";
import { KpiCards, PipelineFunnel, ActivityFeed, ConversationsList } from "@/components/dashboard/Panels";

export default function Dashboard() {
  const { data, error } = useDashboardData(2000);

  return (
    <main className="mx-auto flex h-dvh max-w-6xl flex-col gap-5 p-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="font-serif text-xl font-bold tracking-wide">
            Hartwell &amp; Vance <span className="text-gold">· Operations</span>
          </h1>
          <p className="text-[11px] uppercase tracking-[0.2em] text-fog">Live intake command center</p>
        </div>
        <div className="flex items-center gap-2 text-xs text-fog">
          <span className={`h-2.5 w-2.5 rounded-full ${error ? "bg-red-400" : "bg-mint animate-pulse"}`} />
          {error ? `connection issue: ${error}` : data ? "LIVE — database feed" : "connecting…"}
        </div>
      </header>

      {!data && !error && (
        <div className="flex flex-1 items-center justify-center text-fog">Loading live data…</div>
      )}

      {data && (
        <>
          <KpiCards kpis={data.kpis} />
          <div className="grid min-h-0 flex-1 grid-cols-1 gap-5 lg:grid-cols-3">
            <div className="space-y-5">
              <PipelineFunnel funnel={data.funnel} />
              <ConversationsList conversations={data.conversations} />
            </div>
            <div className="min-h-0 lg:col-span-2">
              <ActivityFeed events={data.events} />
            </div>
          </div>
        </>
      )}
    </main>
  );
}
