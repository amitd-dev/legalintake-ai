// Event log — every meaningful action lands here; the dashboard reads it in near-real-time.
import { query } from "./db";

export type EventType =
  | "lead_captured"
  | "lead_qualified"
  | "lead_unqualified"
  | "conversation_started"
  | "booking_created"
  | "escalation"
  | "note_recorded"
  | "document_generated"
  | "agent_error";

export async function logEvent(type: EventType, payload: Record<string, unknown>): Promise<void> {
  try {
    await query("insert into events (type, payload) values ($1, $2)", [type, JSON.stringify(payload)]);
  } catch (e) {
    // Event logging must never break the user-facing flow.
    console.error("logEvent failed", type, e);
  }
}
