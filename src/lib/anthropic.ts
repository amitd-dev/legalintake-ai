// Minimal Anthropic Messages API client (server-side only) with a tool-use loop.
// Raw fetch keeps the dependency surface small; the loop is what Phase 2 tools plug into.
import { model } from "./config";

export type ChatMessage = { role: "user" | "assistant"; content: unknown };

export type ToolDefinition = {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
};

export type ToolHandler = (input: Record<string, unknown>) => Promise<Record<string, unknown>>;

type ContentBlock =
  | { type: "text"; text: string }
  | { type: "tool_use"; id: string; name: string; input: Record<string, unknown> };

type ApiResponse = {
  content: ContentBlock[];
  stop_reason: string;
};

async function callApi(
  system: string,
  messages: ChatMessage[],
  tools: ToolDefinition[],
  maxTokens: number,
  serverTools: unknown[] = []
): Promise<ApiResponse> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error("ANTHROPIC_API_KEY is not configured");

  const body: Record<string, unknown> = { model, max_tokens: maxTokens, system, messages };
  const allTools = [...tools, ...serverTools];
  if (allTools.length) body.tools = allTools;

  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": key,
      "anthropic-version": "2023-06-01"
    },
    body: JSON.stringify(body)
  });

  if (!r.ok) {
    const detail = await r.text();
    console.error("Anthropic API error", r.status, detail.slice(0, 400));
    throw new Error(`AI service error (${r.status})`);
  }
  return (await r.json()) as ApiResponse;
}

/**
 * Runs the agent: calls Claude, executes any requested tools, feeds results back,
 * and repeats until Claude produces a final text reply (or the safety cap is hit).
 * Returns the final text plus the names of tools that ran (for event logging upstream).
 */
export async function runAgent(opts: {
  system: string;
  messages: ChatMessage[];
  tools?: ToolDefinition[];
  handlers?: Record<string, ToolHandler>;
  maxTokens?: number;
  /** Anthropic server-side tools (e.g. web search) — executed by the API, no handler needed. */
  serverTools?: unknown[];
}): Promise<{ reply: string; toolsUsed: string[] }> {
  const { system, tools = [], handlers = {}, maxTokens = 800 } = opts;
  const convo: ChatMessage[] = [...opts.messages];
  const toolsUsed: string[] = [];

  for (let round = 0; round < 6; round++) {
    const res = await callApi(system, convo, tools, maxTokens, opts.serverTools || []);
    const toolUses = res.content.filter((b): b is Extract<ContentBlock, { type: "tool_use" }> => b.type === "tool_use");

    if (res.stop_reason !== "tool_use" || toolUses.length === 0) {
      const reply = res.content
        .filter((b): b is Extract<ContentBlock, { type: "text" }> => b.type === "text")
        .map((b) => b.text)
        .join("")
        .trim();
      return { reply, toolsUsed };
    }

    // Execute requested tools, then hand results back to the model.
    convo.push({ role: "assistant", content: res.content });
    const results = [];
    for (const use of toolUses) {
      toolsUsed.push(use.name);
      let output: Record<string, unknown>;
      try {
        const handler = handlers[use.name];
        output = handler ? await handler(use.input) : { error: `unknown tool: ${use.name}` };
      } catch (e) {
        console.error(`tool ${use.name} failed`, e);
        output = { error: e instanceof Error ? e.message : "tool execution failed" };
      }
      results.push({
        type: "tool_result",
        tool_use_id: use.id,
        content: JSON.stringify(output)
      });
    }
    convo.push({ role: "user", content: results });
  }

  return { reply: "I'm sorry — something went wrong on my end. A member of our staff will follow up with you shortly.", toolsUsed };
}
