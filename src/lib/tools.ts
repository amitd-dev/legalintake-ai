// Agent tools: schemas Claude sees + handlers that hit the database.
// Every successful tool call also writes an `events` row so the dashboard updates instantly.
import type { ToolDefinition, ToolHandler } from "./anthropic";
import { query } from "./db";
import { logEvent } from "./events";
import { firmConfig } from "./config";
import { calendarConfigured, checkAvailability, bookConsultation, humanSlot, internalAvailability } from "./calendar";
import { sendEscalationEmail } from "./notify";

export const toolDefinitions: ToolDefinition[] = [
  {
    name: "save_lead",
    description:
      "Save or update the prospective client's intake record. Call as soon as you have their name, contact info, and a case summary. Call again with the same info plus corrections if details change.",
    input_schema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Full name" },
        phone: { type: "string", description: "Phone number" },
        email: { type: "string", description: "Email address" },
        case_type: {
          type: "string",
          description: `One of: ${firmConfig.practiceAreas.join(", ")} — or "other" if outside our practice areas`
        },
        case_summary: { type: "string", description: "2-4 sentence factual summary of the matter" },
        urgency: { type: "string", enum: ["low", "medium", "high"] },
        qualified: {
          type: "boolean",
          description: "true if the matter fits our practice areas and warrants a consultation"
        },
        estimated_value: {
          type: "number",
          description: "Rough estimated matter value in USD (fees or recovery), if inferable; omit if unknown"
        }
      },
      required: ["name", "case_summary", "urgency", "qualified"]
    }
  },
  {
    name: "escalate",
    description:
      "Flag this conversation for immediate human follow-up. Use for crisis/distress, arrests, imminent court dates, emergencies, explicit requests for a human, or when unsure how to proceed safely.",
    input_schema: {
      type: "object",
      properties: {
        reason: { type: "string", description: "Why this needs a human, one or two sentences" }
      },
      required: ["reason"]
    }
  },
  {
    name: "check_availability",
    description: "Get open consultation slots on the firm calendar for the coming days. Use before offering times.",
    input_schema: {
      type: "object",
      properties: {
        case_type: { type: "string", description: "The matter's practice area, to match the right attorney" }
      },
      required: []
    }
  },
  {
    name: "book_consultation",
    description:
      "Book a consultation on the firm calendar. Only call after save_lead succeeded and the client explicitly confirmed a specific offered slot.",
    input_schema: {
      type: "object",
      properties: {
        slot_iso: { type: "string", description: "Chosen slot start time, ISO 8601" },
        attorney_name: { type: "string", description: "Attorney for the consultation" }
      },
      required: ["slot_iso", "attorney_name"]
    }
  }
];

/**
 * Handlers close over the current conversation context so tool effects
 * are attributed to the right conversation/lead.
 */
export function makeToolHandlers(ctx: {
  conversationId: string;
  getLeadId: () => string | null;
  setLeadId: (id: string) => void;
  markEscalated: () => void;
}): Record<string, ToolHandler> {
  return {
    save_lead: async (input) => {
      const status = input.qualified === true ? "qualified" : "unqualified";
      const existing = ctx.getLeadId();
      let leadId: string;

      if (existing) {
        await query(
          `update leads set name=$1, phone=$2, email=$3, case_type=$4, case_summary=$5,
             urgency=$6, qualification_status=$7, estimated_value=$8 where id=$9`,
          [
            input.name ?? null, input.phone ?? null, input.email ?? null, input.case_type ?? null,
            input.case_summary ?? null, input.urgency ?? null, status, input.estimated_value ?? null, existing
          ]
        );
        leadId = existing;
      } else {
        const rows = await query<{ id: string }>(
          `insert into leads (name, phone, email, case_type, case_summary, urgency, qualification_status, estimated_value, source)
           values ($1,$2,$3,$4,$5,$6,$7,$8,'web') returning id`,
          [
            input.name ?? null, input.phone ?? null, input.email ?? null, input.case_type ?? null,
            input.case_summary ?? null, input.urgency ?? null, status, input.estimated_value ?? null
          ]
        );
        leadId = rows[0].id;
        ctx.setLeadId(leadId);
        await query("update conversations set lead_id=$1 where id=$2", [leadId, ctx.conversationId]);
      }

      await logEvent(input.qualified === true ? "lead_qualified" : "lead_captured", {
        lead_id: leadId,
        name: input.name,
        case_type: input.case_type,
        urgency: input.urgency,
        estimated_value: input.estimated_value ?? null
      });
      return { ok: true, lead_id: leadId, status };
    },

    escalate: async (input) => {
      ctx.markEscalated();
      await query("update conversations set escalated=true, status='escalated' where id=$1", [ctx.conversationId]);
      await logEvent("escalation", {
        conversation_id: ctx.conversationId,
        lead_id: ctx.getLeadId(),
        reason: input.reason
      });
      // notify a human (email if configured; dashboard always)
      const leadId = ctx.getLeadId();
      const leadRow = leadId
        ? (await query<{ name: string | null; phone: string | null; email: string | null }>(
            "select name, phone, email from leads where id=$1", [leadId]
          ))[0]
        : null;
      void sendEscalationEmail({
        reason: String(input.reason || ""),
        leadName: leadRow?.name,
        contact: [leadRow?.phone, leadRow?.email].filter(Boolean).join(" · "),
        conversationId: ctx.conversationId
      });
      return { ok: true, message: "A staff member has been notified and will reach out shortly." };
    },

    check_availability: async () => {
      // Google-backed when credentials exist; internal business-hours scheduler otherwise.
      const slots = calendarConfigured() ? await checkAvailability(6) : internalAvailability(6);
      if (!slots.length) {
        return { ok: false, error: "No open slots in the next 7 days. Offer that a staff member will call to schedule." };
      }
      return { ok: true, slots, note: "Offer 2-3 of these to the client. Use the exact iso value when booking." };
    },

    book_consultation: async (input) => {
      const leadId = ctx.getLeadId();
      if (!leadId) {
        return { ok: false, error: "No saved lead yet — call save_lead with the client's contact info before booking." };
      }
      const slotIso = String(input.slot_iso || "");
      const attorney = String(input.attorney_name || firmConfig.attorneys[0].name);
      if (Number.isNaN(Date.parse(slotIso))) {
        return { ok: false, error: "slot_iso must be a valid ISO timestamp from check_availability." };
      }

      const leadRows = await query<{ name: string; phone: string | null; email: string | null; case_type: string | null; case_summary: string | null }>(
        "select name, phone, email, case_type, case_summary from leads where id=$1",
        [leadId]
      );
      const lead = leadRows[0];

      let eventId: string;
      let htmlLink = "";
      let calendarBackend: "google" | "internal";
      if (calendarConfigured()) {
        const res = await bookConsultation({
          slotIso,
          attorneyName: attorney,
          clientName: lead?.name || "Prospective client",
          contact: [lead?.phone, lead?.email].filter(Boolean).join(" · ") || "on file",
          caseType: lead?.case_type || "consultation",
          caseSummary: lead?.case_summary || ""
        });
        eventId = res.eventId;
        htmlLink = res.htmlLink;
        calendarBackend = "google";
      } else {
        // Internal scheduler: booking is a real DB record; no external calendar event.
        eventId = `internal-${crypto.randomUUID()}`;
        calendarBackend = "internal";
      }

      await query(
        `insert into bookings (lead_id, calendar_event_id, scheduled_at, attorney_name, status)
         values ($1,$2,$3,$4,'confirmed')`,
        [leadId, eventId, slotIso, attorney]
      );
      await query("update leads set qualification_status='booked' where id=$1", [leadId]);
      await logEvent("booking_created", {
        lead_id: leadId,
        attorney,
        slot: humanSlot(slotIso),
        slot_iso: slotIso,
        calendar_event_id: eventId,
        calendar_backend: calendarBackend,
        event_link: htmlLink
      });

      return { ok: true, booked: humanSlot(slotIso), attorney, calendar_event_id: eventId };
    }
  };
}
