// Phase 6 stub — Twilio voice/SMS channel.
// The intake agent is channel-agnostic: /api/chat already accepts a `channel`
// concept via the conversations table ('web' | 'phone' | 'sms').
// Implementation plan: Twilio webhook -> transcribe/receive -> POST to the same
// agent runner -> reply via Twilio API; conversation persisted identically.

export interface InboundSms {
  from: string;
  body: string;
}

export interface VoiceTranscript {
  callSid: string;
  from: string;
  transcript: string;
}

export async function handleInboundSms(_msg: InboundSms): Promise<never> {
  throw new Error("Twilio SMS channel not implemented (Phase 6)");
}

export async function handleVoiceTranscript(_t: VoiceTranscript): Promise<never> {
  throw new Error("Twilio voice channel not implemented (Phase 6)");
}
