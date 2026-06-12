// Phase 6 stub — Stripe consultation-fee payment links.
// Plan: after book_consultation, optionally generate a Stripe Payment Link for the
// consultation fee, store on the booking row, include in the confirmation message.

export interface PaymentLinkRequest {
  leadId: string;
  bookingId: string;
  amountCents: number;
  description: string;
}

export async function createConsultationPaymentLink(_req: PaymentLinkRequest): Promise<never> {
  throw new Error("Stripe payments not implemented (Phase 6)");
}
