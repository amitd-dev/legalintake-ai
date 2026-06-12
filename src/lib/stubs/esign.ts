// Phase 6 stub — e-signature for engagement letters (DocuSign/PandaDoc).
// Plan: Phase 7's Document Drafting Agent generates the engagement letter;
// this module sends it for signature and tracks status on the documents table.

export interface SignatureRequest {
  documentId: string;
  signerName: string;
  signerEmail: string;
}

export async function sendForSignature(_req: SignatureRequest): Promise<never> {
  throw new Error("E-signature not implemented (Phase 6)");
}
