// Escalation notifications via Resend. No-op (logged) until RESEND_API_KEY
// and ESCALATION_EMAIL are configured — escalations always reach the dashboard regardless.
import { firmConfig } from "./config";

export async function sendEscalationEmail(opts: {
  reason: string;
  leadName?: string | null;
  contact?: string | null;
  conversationId: string;
}): Promise<void> {
  const key = process.env.RESEND_API_KEY;
  const to = process.env.ESCALATION_EMAIL;
  if (!key || !to) {
    console.log("[escalation] email not configured — dashboard-only. Reason:", opts.reason);
    return;
  }
  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
      body: JSON.stringify({
        from: "intake@resend.dev", // replace with a verified domain sender in production
        to: [to],
        subject: `⚠ Intake escalation — ${opts.leadName || "unidentified caller"}`,
        text:
          `An intake conversation was escalated and needs human follow-up.\n\n` +
          `Firm: ${firmConfig.name}\n` +
          `Caller: ${opts.leadName || "not yet identified"}\n` +
          `Contact: ${opts.contact || "not yet collected"}\n` +
          `Reason: ${opts.reason}\n` +
          `Conversation: ${opts.conversationId}\n\n` +
          `Open the operations dashboard for the full transcript.`
      })
    });
    if (!r.ok) console.error("Resend error", r.status, await r.text());
  } catch (e) {
    console.error("escalation email failed", e);
  }
}
