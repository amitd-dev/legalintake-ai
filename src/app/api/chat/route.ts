// POST /api/chat — the intake agent endpoint.
// Phase 2: full persistence (conversations, messages) + tool calling (save_lead, escalate)
// + event logging. Falls back to stateless mode if DATABASE_URL isn't configured.
import { NextRequest, NextResponse } from "next/server";
import { runAgent, type ChatMessage } from "@/lib/anthropic";
import { intakeSystemPrompt } from "@/lib/prompts";
import { dbConfigured, query } from "@/lib/db";
import { toolDefinitions, makeToolHandlers } from "@/lib/tools";
import { logEvent } from "@/lib/events";
import { rateLimit } from "@/lib/rateLimit";

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

  while (filtered.length && filtered[0].role !== "user") filtered.shift();
  return filtered.reduce<ChatMessage[]>((acc, m) => {
    const last = acc[acc.length - 1];
    if (last && last.role === m.role && typeof last.content === "string") {
      last.content = `${last.content}\n${m.content}`;
    } else {
      acc.push({ ...m });
    }
    return acc;
  }, []);
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const rl = rateLimit(ip);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: "You're sending messages a little fast — please wait a moment and try again." },
        { status: 429 }
      );
    }

    const body = await req.json().catch(() => null);
    const messages = sanitizeMessages(body?.messages);
    if (!messages.length) {
      return NextResponse.json({ error: "messages array with at least one user message is required" }, { status: 400 });
    }
    const lastUser = messages[messages.length - 1];
    const persist = dbConfigured();

    // --- conversation bookkeeping ---
    let conversationId: string | null =
      typeof body?.conversationId === "string" && UUID_RE.test(body.conversationId) ? body.conversationId : null;
    let leadId: string | null = null;
    let escalated = false;

    if (persist) {
      if (conversationId) {
        const rows = await query<{ id: string; lead_id: string | null }>(
          "select id, lead_id from conversations where id=$1",
          [conversationId]
        );
        if (rows.length) {
          leadId = rows[0].lead_id;
        } else {
          conversationId = null;
        }
      }
      if (!conversationId) {
        const rows = await query<{ id: string }>(
          "insert into conversations (channel, status) values ('web','active') returning id"
        );
        conversationId = rows[0].id;
        await logEvent("conversation_started", { conversation_id: conversationId, channel: "web" });
      }
      await query("insert into messages (conversation_id, role, content) values ($1,'user',$2)", [
        conversationId,
        typeof lastUser.content === "string" ? lastUser.content : ""
      ]);
    }

    // --- run the agent with tools ---
    const handlers = persist
      ? makeToolHandlers({
          conversationId: conversationId as string,
          getLeadId: () => leadId,
          setLeadId: (id) => { leadId = id; },
          markEscalated: () => { escalated = true; }
        })
      : {};

    const { reply, toolsUsed } = await runAgent({
      system: intakeSystemPrompt(),
      messages,
      tools: persist ? toolDefinitions : [],
      handlers
    });

    if (persist && conversationId) {
      await query("insert into messages (conversation_id, role, content) values ($1,'agent',$2)", [
        conversationId,
        reply
      ]);
    }

    return NextResponse.json({ reply, conversationId, escalated, toolsUsed });
  } catch (e) {
    console.error("/api/chat error", e);
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
