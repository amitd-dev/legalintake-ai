export type Lead = {
  id: string;
  created_at: string;
  name: string | null;
  phone: string | null;
  email: string | null;
  case_type: string | null;
  case_summary: string | null;
  urgency: "low" | "medium" | "high" | null;
  qualification_status: "new" | "qualified" | "unqualified" | "booked";
  estimated_value: string | null; // numeric comes back as string from pg
  source: string;
};

export type Conversation = {
  id: string;
  lead_id: string | null;
  channel: "web" | "phone" | "sms";
  started_at: string;
  ended_at: string | null;
  status: "active" | "ended" | "escalated";
  escalated: boolean;
};

export type Message = {
  id: string;
  conversation_id: string;
  role: "user" | "agent";
  content: string;
  created_at: string;
};

export type Booking = {
  id: string;
  lead_id: string;
  calendar_event_id: string | null;
  scheduled_at: string;
  attorney_name: string;
  status: "confirmed" | "no_show" | "completed" | "cancelled";
  created_at: string;
};

export type EventRow = {
  id: string;
  type: string;
  payload: Record<string, unknown>;
  created_at: string;
};
