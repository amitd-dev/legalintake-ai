// Google Calendar integration (service account).
// Requires GOOGLE_SERVICE_ACCOUNT_JSON (full key JSON, single line) and GOOGLE_CALENDAR_ID,
// with the calendar shared to the service account's client_email ("Make changes to events").
import { google, calendar_v3 } from "googleapis";

const TIMEZONE = process.env.FIRM_TIMEZONE || "America/New_York";
const SLOT_MINUTES = 45;
const BUSINESS_START_HOUR = 9; // local firm time
const BUSINESS_END_HOUR = 17;

export function calendarConfigured(): boolean {
  return Boolean(process.env.GOOGLE_SERVICE_ACCOUNT_JSON && process.env.GOOGLE_CALENDAR_ID);
}

function client(): calendar_v3.Calendar {
  const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON as string);
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ["https://www.googleapis.com/auth/calendar"]
  });
  return google.calendar({ version: "v3", auth });
}

/** Hour of day (0-23) in the firm's timezone for a given instant. */
function hourInTz(d: Date): number {
  return Number(new Intl.DateTimeFormat("en-US", { timeZone: TIMEZONE, hour: "numeric", hour12: false }).format(d));
}
function dayInTz(d: Date): number {
  // 0 = Sunday … 6 = Saturday
  return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(
    new Intl.DateTimeFormat("en-US", { timeZone: TIMEZONE, weekday: "short" }).format(d)
  );
}

export function humanSlot(iso: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: TIMEZONE,
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(new Date(iso));
}

/**
 * Returns up to `limit` open consultation slots over the next 7 days,
 * inside business hours, checked against real calendar busy times.
 */
export async function checkAvailability(limit = 6): Promise<{ iso: string; label: string }[]> {
  const cal = client();
  const calendarId = process.env.GOOGLE_CALENDAR_ID as string;

  const now = new Date();
  const windowStart = new Date(now.getTime() + 60 * 60 * 1000); // nothing sooner than 1h out
  const windowEnd = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  const fb = await cal.freebusy.query({
    requestBody: {
      timeMin: windowStart.toISOString(),
      timeMax: windowEnd.toISOString(),
      items: [{ id: calendarId }]
    }
  });
  const busy = (fb.data.calendars?.[calendarId]?.busy || []).map((b) => ({
    start: new Date(b.start as string).getTime(),
    end: new Date(b.end as string).getTime()
  }));

  const slots: { iso: string; label: string }[] = [];
  // Walk the window in 30-minute steps; accept slots starting on the half hour.
  const step = 30 * 60 * 1000;
  let t = Math.ceil(windowStart.getTime() / step) * step;
  for (; t < windowEnd.getTime() && slots.length < limit; t += step) {
    const start = new Date(t);
    const end = t + SLOT_MINUTES * 60 * 1000;
    const day = dayInTz(start);
    if (day === 0 || day === 6) continue; // weekends
    const hour = hourInTz(start);
    if (hour < BUSINESS_START_HOUR || hour >= BUSINESS_END_HOUR) continue;
    const overlaps = busy.some((b) => t < b.end && end > b.start);
    if (overlaps) continue;
    slots.push({ iso: start.toISOString(), label: humanSlot(start.toISOString()) });
  }
  return slots;
}

/**
 * Internal scheduler fallback (no Google credentials configured).
 * Generates real business-hours slots from the clock — bookings are still real
 * database records; only the external Google Calendar event is skipped.
 */
export function internalAvailability(limit = 6): { iso: string; label: string }[] {
  const now = new Date();
  const windowStart = new Date(now.getTime() + 60 * 60 * 1000);
  const slots: { iso: string; label: string }[] = [];
  const step = 30 * 60 * 1000;
  let t = Math.ceil(windowStart.getTime() / step) * step;
  const windowEnd = now.getTime() + 7 * 24 * 60 * 60 * 1000;
  for (; t < windowEnd && slots.length < limit; t += step) {
    const start = new Date(t);
    const day = dayInTz(start);
    if (day === 0 || day === 6) continue;
    const hour = hourInTz(start);
    if (hour < BUSINESS_START_HOUR || hour >= BUSINESS_END_HOUR) continue;
    // offer slots on the hour / half hour spaced out across days
    slots.push({ iso: start.toISOString(), label: humanSlot(start.toISOString()) });
    t += 90 * 60 * 1000; // spread offered slots out
  }
  return slots;
}

/** Creates a real calendar event. Returns the Google event id and link. */
export async function bookConsultation(opts: {
  slotIso: string;
  attorneyName: string;
  clientName: string;
  contact: string;
  caseType: string;
  caseSummary: string;
}): Promise<{ eventId: string; htmlLink: string }> {
  const cal = client();
  const start = new Date(opts.slotIso);
  const end = new Date(start.getTime() + SLOT_MINUTES * 60 * 1000);

  const res = await cal.events.insert({
    calendarId: process.env.GOOGLE_CALENDAR_ID as string,
    requestBody: {
      summary: `Consultation — ${opts.clientName} (${opts.caseType})`,
      description:
        `New client consultation booked by the intake agent.\n\n` +
        `Client: ${opts.clientName}\nContact: ${opts.contact}\nAttorney: ${opts.attorneyName}\n\n` +
        `Case summary:\n${opts.caseSummary}`,
      start: { dateTime: start.toISOString(), timeZone: TIMEZONE },
      end: { dateTime: end.toISOString(), timeZone: TIMEZONE }
    }
  });

  if (!res.data.id) throw new Error("calendar event creation failed");
  return { eventId: res.data.id, htmlLink: res.data.htmlLink || "" };
}
