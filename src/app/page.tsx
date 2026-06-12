import ChatWindow from "@/components/chat/ChatWindow";
import { firmConfig } from "@/lib/config";

export default function Home({ searchParams }: { searchParams?: { src?: string } }) {
  const source = ["facebook", "google", "referral", "web"].includes(searchParams?.src || "")
    ? (searchParams!.src as string)
    : "web";
  return (
    <main className="mx-auto flex h-dvh max-w-2xl flex-col">
      <header className="flex items-center gap-3.5 border-b border-edge bg-panel px-5 py-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-gold to-[#8a6d1f] font-serif text-sm font-extrabold text-ink">
          {firmConfig.name
            .split(" ")
            .filter((w) => /^[A-Z]/.test(w))
            .slice(0, 2)
            .map((w) => w[0])
            .join("")}
        </div>
        <div>
          <h1 className="font-serif text-[15px] font-bold tracking-wide">{firmConfig.name}</h1>
          <p className="text-[11px] uppercase tracking-[0.18em] text-fog">
            Client intake · Available 24/7
          </p>
        </div>
        <span className="ml-auto flex items-center gap-2 text-[11px] text-mint">
          <span className="h-2 w-2 animate-pulse rounded-full bg-mint" /> Online
        </span>
      </header>
      <div className="min-h-0 flex-1 bg-panel">
        <ChatWindow firmName={firmConfig.name} source={source} />
      </div>
    </main>
  );
}
