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

/**
 * Billing Agent (Phase 10) stub: returns a placeholder payment-link URL for an
 * invoice. When STRIPE_SECRET_KEY is configured this is where a real Stripe
 * Payment Link would be created; until then it returns a clearly-marked demo URL.
 */
export function paymentLink(invoiceNumber: string, _amount: number): string {
  return `https://pay.example.com/demo/${encodeURIComponent(invoiceNumber)}`;
}
