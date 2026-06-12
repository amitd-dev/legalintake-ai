"use client";

// Left-sidebar application shell shared by internal pages (dashboard, paralegal).
import React from "react";

const ITEMS: { label: string; href?: string; icon: string; soon?: boolean }[] = [
  { label: "Operations", href: "/dashboard", icon: "M3 13h4v8H3zM10 7h4v14h-4zM17 3h4v18h-4z" },
  { label: "Paralegal", href: "/paralegal", icon: "M5 3h10l4 4v14H5zM14 3v5h5" },
  { label: "Client chat", href: "/", icon: "M4 5h16v11H8l-4 4z" },
  { label: "Documents", icon: "M6 3h9l4 4v14H6zM14 3v5h5", soon: true },
  { label: "Research", icon: "M10 4a6 6 0 1 0 0 12 6 6 0 0 0 0-12zM15 15l5 5", soon: true },
  { label: "Billing", icon: "M4 5h16v14H4zM4 10h16", soon: true },
  { label: "Deadlines", icon: "M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16zM12 8v5l3 2", soon: true }
];

export default function Shell({ active, children }: { active: string; children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh bg-[#0a0a0b] text-zinc-100">
      {/* sidebar */}
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-56 flex-col border-r border-white/[0.06] bg-[#0d0d0f] md:flex">
        <div className="flex items-center gap-3 px-5 py-5">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-gradient-to-br from-[#e3b341] to-[#8a6d1f] font-serif text-[12px] font-bold text-black">
            HV
          </div>
          <div>
            <p className="text-[13px] font-semibold leading-tight tracking-tight">Hartwell &amp; Vance</p>
            <p className="text-[10px] uppercase tracking-[0.16em] text-zinc-500">LegalIntake AI</p>
          </div>
        </div>

        <nav className="mt-2 flex-1 space-y-0.5 px-3">
          <p className="px-2 pb-1.5 pt-2 text-[9.5px] font-semibold uppercase tracking-[0.16em] text-zinc-600">
            Workspace
          </p>
          {ITEMS.filter((i) => !i.soon).map((i) => (
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
            Modules
          </p>
          {ITEMS.filter((i) => i.soon).map((i) => (
            <span
              key={i.label}
              className="flex cursor-default items-center gap-3 rounded-md px-2.5 py-2 text-[12.5px] text-zinc-600"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" strokeLinecap="round">
                <path d={i.icon} />
              </svg>
              {i.label}
              <span className="ml-auto rounded border border-white/[0.07] px-1.5 py-0.5 text-[8.5px] font-semibold uppercase tracking-wide text-zinc-600">
                soon
              </span>
            </span>
          ))}
        </nav>

        <div className="space-y-2 border-t border-white/[0.06] px-5 py-4">
          <div className="flex items-center justify-between">
            <span className="rounded border border-white/[0.08] px-1.5 py-0.5 text-[9px] font-medium text-zinc-500">
              PRODUCTION
            </span>
            <span className="text-[9.5px] text-zinc-600">v1.0</span>
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
      <div className="min-w-0 flex-1 md:pl-56">{children}</div>
    </div>
  );
}
