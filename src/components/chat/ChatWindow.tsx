"use client";

import { useEffect, useRef, useState } from "react";

type Msg = { role: "user" | "assistant"; content: string };

const GREETING =
  "Hello, and thank you for reaching out. I'm the intake assistant here — I can take down the details of your situation and get you scheduled with one of our attorneys. What brings you in today?";

export default function ChatWindow({ firmName }: { firmName: string }) {
  const [messages, setMessages] = useState<Msg[]>([{ role: "assistant", content: GREETING }]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, busy]);

  async function send() {
    const text = input.trim();
    if (!text || busy) return;
    setInput("");
    setError(null);
    const next: Msg[] = [...messages, { role: "user" as const, content: text }];
    setMessages(next);
    setBusy(true);
    try {
      const r = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ messages: next })
      });
      const data = await r.json();
      if (!r.ok || data.error) {
        setError(data.error || "Connection issue — please try again.");
      } else {
        setMessages((m) => [...m, { role: "assistant", content: data.reply }]);
      }
    } catch {
      setError("Network error — please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex h-full flex-col">
      {/* messages */}
      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-5">
        {messages.map((m, i) => (
          <div
            key={i}
            className={
              m.role === "assistant"
                ? "max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-bl-sm border border-edge bg-panel-2 px-4 py-2.5 text-[13.5px] leading-relaxed"
                : "ml-auto max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-sm bg-[#2d4a8a] px-4 py-2.5 text-[13.5px] leading-relaxed"
            }
          >
            {m.content}
          </div>
        ))}
        {busy && (
          <div className="flex w-16 items-center gap-1.5 rounded-2xl rounded-bl-sm border border-edge bg-panel-2 px-4 py-3">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-fog" />
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-fog [animation-delay:150ms]" />
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-fog [animation-delay:300ms]" />
          </div>
        )}
        {error && (
          <div className="mx-auto w-fit rounded-full border border-red-400/30 bg-red-400/10 px-4 py-1.5 text-xs text-red-300">
            ⚠ {error}
          </div>
        )}
      </div>

      {/* composer */}
      <div className="flex gap-2.5 border-t border-edge p-4">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
          placeholder="Describe your legal matter..."
          autoFocus
          className="flex-1 rounded-xl border border-edge bg-panel-2 px-4 py-3 text-sm outline-none transition-colors focus:border-sky"
        />
        <button
          onClick={send}
          disabled={busy || !input.trim()}
          className="rounded-xl bg-gradient-to-br from-gold to-amber px-5 text-sm font-bold text-ink disabled:opacity-50"
        >
          Send
        </button>
      </div>

      <p className="border-t border-edge px-4 py-2 text-center text-[10.5px] text-fog">
        {firmName} · This assistant handles intake only and does not provide legal advice.
      </p>
    </div>
  );
}
