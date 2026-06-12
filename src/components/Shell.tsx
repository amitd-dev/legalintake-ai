"use client";

// Left-sidebar application shell shared by internal pages (dashboard, paralegal).
import React from "react";

const NAV: { label: string; href: string; icon: string }[] = [
  { label: "Operations", href: "/dashboard", icon: "M3 13h4v8H3zM10 7h4v14h-4zM17 3h4v18h-4z" },
  { label: "Paralegal", href: "/paralegal", icon: "M5 3h10l4 4v14H5zM14 3v5h5" },
  { label: "Client chat", href: "/", icon: "M4 5h16v11H8l-4 4z" }
];

const AGENTS: { label: string; desc: string; href?: string; live: boolean }[] = [
  { label: "Intake Agent", desc: "24/7 intake & booking", href: "/", live: true },
  { label: "Note-Taker Agent", desc: "Consultation notes", href: "/paralegal", live: true },
  { label: "Paralegal Agent", desc: "USCIS forms (G-28)", href: "/paralegal", live: true },
  { label: "Marketing Agent", desc: "Campaigns & lead gen", live: false },
  { label: "Drafting Agent", desc: "Letters & contracts", live: false },
  { label: "Research Agent", desc: "Legal research memos", live: false },
  { label: "Discovery Agent", desc: "Document review", live: false },
  { label: "Billing Agent", desc: "Time entries & invoices", live: false },
  { label: "Deadline Agent", desc: "Court dates & SOL alerts", live: false }
];

export default function Shell({ active, children }: { active: string; children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh bg-[#0a0a0b] text-zinc-100">
      {/* sidebar */}
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-60 flex-col border-r border-white/[0.06] bg-[#0d0d0f] md:flex">
        <div className="flex items-center gap-3 px-5 py-4">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-gradient-to-br from-[#e3b341] to-[#8a6d1f] font-serif text-[12px] font-bold text-black">
            HV
          </div>
          <div>
            <p className="text-[13px] font-semibold leading-tight tracking-tight">Hartwell &amp; Vance</p>
            <p className="text-[10px] uppercase tracking-[0.16em] text-zinc-500">LegalIntake AI</p>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 pb-3">
          <p className="px-2 pb-1.5 pt-2 text-[9.5px] font-semibold uppercase tracking-[0.16em] text-zinc-600">
            Workspace
          </p>
          {NAV.map((i) => (
            <a
              key={i.label}
              href={i.href}
              className={`flex items-center gap-3 rounded-md px-2.5 py-2 text-[12.5px] ${
                active === i.label
                  ? "bg-white/[0.07] font-medium text-zinc-100"
                  : "text-zinc-400 hover:bg-white/[0.04] hover:text-zinc-200"
              }`}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" strokeLinecap="round">
                <path d={i.icon} />
              </svg>
              {i.label}
            </a>
          ))}

          <p className="px-2 pb-1.5 pt-4 text-[9.5px] font-semibold uppercase tracking-[0.16em] text-zinc-600">
            AI Staff
          </p>
          {AGENTS.map((a) =>
            a.live ? (
              <a
                key={a.label}
                href={a.href}
                className="group flex items-center gap-2.5 rounded-md px-2.5 py-[7px] hover:bg-white/[0.04]"
              >
                <span className="h-1.5 w-1.5 flex-shrink-0 rounded-full bg-emerald-400" />
                <span className="min-w-0">
                  <span className="block truncate text-[12px] text-zinc-300 group-hover:text-zinc-100">{a.label}</span>
                  <span className="block truncate text-[10px] text-zinc-600">{a.desc}</span>
                </span>
              </a>
            ) : (
              <span key={a.label} className="flex cursor-default items-center gap-2.5 rounded-md px-2.5 py-[7px]">
                <span className="h-1.5 w-1.5 flex-shrink-0 rounded-full bg-zinc-700" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[12px] text-zinc-600">{a.label}</span>
                  <span className="block truncate text-[10px] text-zinc-700">{a.desc}</span>
                </span>
                <span className="rounded border border-white/[0.07] px-1 py-px text-[8px] font-semibold uppercase tracking-wide text-zinc-600">
                  soon
                </span>
              </span>
            )
          )}
        </nav>

        <div className="space-y-2 border-t border-white/[0.06] px-5 py-3.5">
          <div className="flex items-center justify-between">
            <span className="rounded border border-white/[0.08] px-1.5 py-0.5 text-[9px] font-medium text-zinc-500">
              PRODUCTION
            </span>
            <span className="text-[9.5px] text-zinc-600">v1.1</span>
          </div>
          <div className="flex items-center gap-2.5">
            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-white/[0.08] text-[9.5px] font-semibold text-zinc-300">
              AD
            </div>
            <span className="text-[11px] text-zinc-500">Firm Administrator</span>
          </div>
        </div>
      </aside>

      {/* content */}
      <div className="min-w-0 flex-1 md:pl-60">{children}</div>
    </div>
  );
}
