// POST /api/chat — the intake agent endpoint.
// Phase 1: stateless Claude call with the intake system prompt.
// Phase 2 will add: conversation persistence, tool calling (save_lead/escalate), event logging.
import { NextRequest, NextResponse } from "next/server";
import { runAgent, type ChatMessage } from "@/lib/anthropic";
import { intakeSystemPrompt } from "@/lib/prompts";

export const runtime = "nodejs";
export const maxDuration = 60;

type IncomingMessage = { role: string; content: string };

function sanitizeMessages(raw: unknown): ChatMessage[] {
  if (!Array.isArray(raw)) return [];
  const filtered = (raw as IncomingMessage[])
    .filter(
      (m) =>
        m &&
        (m.role === "user" || m.role === "assistant") &&
        typeof m.content === "string" &&
        m.content.length > 0 &&
        m.content.length <= 4000
    )
    .slice(-40)
    .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));

  // Anthropic API requires user-first, alternating roles.
  while (filtered.length && filtered[0].role !== "user") filtered.shift();
  return filtered.reduce<ChatMessage[]>((acc, m) => {
    const last = acc[acc.length - 1];
    if (last && last.role === m.role) {
      last.content = `${last.content}\n${m.content}`;
    } else {
      acc.push({ ...m });
    }
    return acc;
  }, []);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    const messages = sanitizeMessages(body?.messages);
    if (!messages.length) {
      return NextResponse.json({ error: "messages array with at least one user message is required" }, { status: 400 });
    }

    const { reply } = await runAgent({
      system: intakeSystemPrompt(),
      messages
    });

    return NextResponse.json({ reply });
  } catch (e) {
    console.error("/api/chat error", e);
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
