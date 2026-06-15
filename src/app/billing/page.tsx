"use client";

// Billing workspace: the Billing Agent drafts itemized time entries from a matter's
// activity and compiles a draft invoice. AI first-pass — attorney review required
// before any client is billed. Stripe payment links are stubbed.
import { useEffect, useState } from "react";
import Shell from "@/components/Shell";

type LineItem = { entry_date: string; narrative: string; hours: number; rate: number; amount: number };

type Invoice = {
  id: string;
  invoice_number: string;
  client_name: string;
  matter: string;
  line_items: LineItem[];
  subtotal: string;
  total: string;
  status: string;
  payment_link: string | null;
  created_at: string;
};

const HAIR = "border-white/[0.06]";
const PANEL = `rounded-lg border ${HAIR} bg-[#101012]`;
const LABEL = "text-[10px] font-medium uppercase tracking-[0.14em] text-zinc-500";
const BTN =
  "rounded-md border border-white/[0.1] bg-white/[0.04] px-3.5 py-2 text-[12.5px] font-medium text-zinc-100 hover:bg-white/[0.08] disabled:opacity-40";
const money = (v: string | number) => "$" + Number(v).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function Billing() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [matter, setMatter] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function load() {
    const r = await fetch("/api/agent/billing", { cache: "no-store" });
    const d = await r.json();
    if (d.invoices) setInvoices(d.invoices);
  }
  useEffect(() => {
    load();
  }, []);

  async function run() {
    if (!matter.trim() || busy) return;
    setBusy(true);
    setErr(null);
    try {
      const r = await fetch("/api/agent/billing", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ matter })
      });
      const d = await r.json();
      if (!r.ok || d.error) setErr(d.error || "invoice generation failed");
      else {
        setMatter("");
        await load();
        setSelected(d.invoiceId);
      }
    } catch {
      setErr("network error");
    }
    setBusy(false);
  }

  const inv = invoices.find((x) => x.id === selected) || null;

  return (
    <Shell active="Billing">
      <header className="sticky top-0 z-10 border-b border-white/[0.06] bg-[#0a0a0b]/90 backdrop-blur">
        <div className="px-6 py-3">
          <h1 className="text-[14px] font-semibold tracking-tight">Billing</h1>
          <p className="text-[10.5px] text-zinc-500">AI-drafted time entries &amp; invoices — attorney review required</p>
        </div>
      </header>

      <main className="space-y-4 px-6 py-5">
        <div className={`${PANEL} p-5`}>
          <p className={`${LABEL} mb-3`}>Billing Agent — draft invoice from matter activity</p>
          <div className="flex flex-col gap-2.5 md:flex-row">
            <input
              value={matter}
              onChange={(e) => setMatter(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && run()}
              placeholder="e.g. Personal injury — Tom Brady Jr. dog-bite matter: intake, consult, demand letter drafted"
              className="flex-1 rounded-md border border-white/[0.08] bg-black/30 px-3.5 py-2.5 text-[13px] outline-none focus:border-sky-400/50"
            />
            <button onClick={run} disabled={busy || !matter.trim()} className={BTN}>
              {busy ? "Drafting…" : "Draft invoice"}
            </button>
          </div>
          {err && <p className="mt-2 text-[12px] text-red-300">⚠ {err}</p>}
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[320px_1fr]">
          <div className={PANEL}>
            <div className={`border-b ${HAIR} px-5 py-3.5`}>
              <p className={LABEL}>Invoices</p>
            </div>
            <div className="divide-y divide-white/[0.04]">
              {invoices.length === 0 && <p className="px-5 py-6 text-[13px] text-zinc-500">No invoices yet.</p>}
              {invoices.map((m) => (
                <button
                  key={m.id}
                  onClick={() => setSelected(m.id)}
                  className={`block w-full px-5 py-3 text-left hover:bg-white/[0.03] ${selected === m.id ? "bg-white/[0.05]" : ""}`}
                >
                  <p className="flex items-center justify-between text-[12.5px] text-zinc-200">
                    <span className="truncate">{m.client_name}</span>
                    <span className="tnum ml-2 flex-shrink-0 text-[#e3b341]">{money(m.total)}</span>
                  </p>
                  <p className="mt-1 text-[10.5px] text-zinc-500">
                    {m.invoice_number} ·{" "}
                    {new Date(m.created_at).toLocaleString("en-US", { month: "short", day: "numeric" })}
                  </p>
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-4">
            {!inv && <div className={`${PANEL} p-8 text-center text-[13px] text-zinc-500`}>Select or draft an invoice.</div>}
            {inv && (
              <div className={`${PANEL} p-6`}>
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-[15px] font-semibold text-zinc-100">{inv.invoice_number}</p>
                    <p className="text-[12px] text-zinc-400">{inv.client_name} · {inv.matter}</p>
                  </div>
                  <span className="rounded border border-white/[0.1] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-zinc-400">
                    {inv.status}
                  </span>
                </div>

                <table className="mt-5 w-full text-[12.5px]">
                  <thead>
                    <tr className="text-left text-[10px] uppercase tracking-[0.12em] text-zinc-500">
                      <th className="py-2 font-medium">Date</th>
                      <th className="py-2 font-medium">Narrative</th>
                      <th className="py-2 text-right font-medium">Hrs</th>
                      <th className="py-2 text-right font-medium">Rate</th>
                      <th className="py-2 text-right font-medium">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.04]">
                    {inv.line_items.map((it, i) => (
                      <tr key={i}>
                        <td className="tnum py-2.5 pr-2 align-top text-zinc-500">{it.entry_date}</td>
                        <td className="py-2.5 pr-2 align-top text-zinc-300">{it.narrative}</td>
                        <td className="tnum py-2.5 text-right align-top text-zinc-400">{Number(it.hours).toFixed(1)}</td>
                        <td className="tnum py-2.5 text-right align-top text-zinc-400">{money(it.rate)}</td>
                        <td className="tnum py-2.5 text-right align-top font-medium text-zinc-100">{money(it.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <div className="mt-4 flex items-center justify-end gap-6 border-t border-white/[0.06] pt-3">
                  <span className={LABEL}>Total due</span>
                  <span className="tnum text-[16px] font-semibold text-[#e3b341]">{money(inv.total)}</span>
                </div>

                {inv.payment_link && (
                  <p className="mt-3 text-[11px] text-zinc-500">
                    Payment link (demo): <span className="text-sky-300/80">{inv.payment_link}</span>
                  </p>
                )}
                <p className="mt-4 rounded-md border border-amber-400/25 bg-amber-400/[0.07] px-3.5 py-2.5 text-[11.5px] leading-relaxed text-amber-200/90">
                  AI-drafted billing. Attorney must review entries for accuracy, reasonableness, and compliance with the fee agreement before sending.
                </p>
              </div>
            )}
          </div>
        </div>
      </main>
    </Shell>
  );
}
