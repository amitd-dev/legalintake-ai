"use client";

import { useEffect, useRef, useState } from "react";

export type DashboardData = {
  kpis: { leads_today: string; qualified_today: string; booked_today: string; pipeline_value: string };
  funnel: { inquiries: string; qualified: string; booked: string; showed: string };
  events: { id: string; type: string; payload: Record<string, unknown>; created_at: string }[];
  conversations: {
    id: string;
    started_at: string;
    status: string;
    escalated: boolean;
    lead_name: string | null;
    case_type: string | null;
    message_count: string;
  }[];
  generated_at: string;
};

/** Polls the aggregate endpoint every `intervalMs`. All values come from the database. */
export function useDashboardData(intervalMs = 2000) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    let alive = true;
    async function tick() {
      try {
        const r = await fetch("/api/dashboard", { cache: "no-store" });
        const d = await r.json();
        if (!alive) return;
        if (!r.ok || d.error) setError(d.error || "fetch failed");
        else {
          setData(d);
          setError(null);
        }
      } catch {
        if (alive) setError("network error");
      }
    }
    tick();
    timer.current = setInterval(tick, intervalMs);
    return () => {
      alive = false;
      if (timer.current) clearInterval(timer.current);
    };
  }, [intervalMs]);

  return { data, error };
}
