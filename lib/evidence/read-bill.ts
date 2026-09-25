import { prisma } from "@/lib/db";
import { writeAuditLog } from "@/lib/db/audit";
import { documentText } from "@/lib/imports/parsers/pdf";
import { BILL_EXTRACTOR_VERSION, extractBill, type BillExtraction } from "./bill-extractor";

export const READABLE_BILL_TYPES = new Set(["application/pdf", "image/jpeg", "image/png", "image/webp"]);

/**
 * Reads a stored bill or receipt (PDF text layer, else OCR), records the
 * result as an EvidenceClassification and returns it. Creates no record.
 */
export async function readBill(
  orgId: string,
  userId: string,
  evidence: { id: string; mimeType: string },
  buffer: Buffer,
): Promise<BillExtraction & { method: string; textPreview: string }> {
  const { text, method } = await documentText(buffer, evidence.mimeType);
  const extraction = extractBill(text);
  const confidence = extraction.amount ? Math.round(extraction.amount.confidence * 100) : 0;
  await prisma.evidenceClassification.create({
    data: {
      evidenceFileId: evidence.id,
      documentType: extraction.kind === "fuel" ? "fuel_receipt" : extraction.kind === "unknown" ? "other" : "utility_bill",
      confidenceScore: confidence,
      extractedFields: { ...extraction, method },
      modelVersion: BILL_EXTRACTOR_VERSION,
    },
  });
  await writeAuditLog({
    organizationId: orgId,
    actorUserId: userId,
    action: "evidence.extracted",
    resourceType: "evidence_file",
    resourceId: evidence.id,
    metadata: { kind: extraction.kind, method, confidence },
  });
  return { ...extraction, method, textPreview: text.slice(0, 600) };
}
