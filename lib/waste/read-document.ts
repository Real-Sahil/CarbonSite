import { prisma } from "@/lib/db";
import { documentText } from "@/lib/imports/parsers/pdf";
import { getObject } from "@/lib/storage";
import { englandRegistration, lookupCarrier } from "@/lib/waste/carrier-register";
import { extractTransferNote, suggestedFill, type TransferNoteReading } from "@/lib/waste/transfer-note-extractor";

/**
 * Reads a waste document's file and keeps what it found (and the England carrier register result) on the
 * document as suggestions. Used by the Read button and, in the background, right after a carrier uploads.
 * A failed register lookup never fails the read. Returns null when the document or file is not the organisation's.
 */
export async function readWasteDocument(orgId: string, id: string) {
  const doc = await prisma.wasteDocument.findFirst({ where: { id, organizationId: orgId } });
  if (!doc) return null;
  const file = await prisma.evidenceFile.findFirst({ where: { id: doc.evidenceFileId, organizationId: orgId }, select: { mimeType: true, storageKey: true } });
  if (!file) return null;
  const { text, method } = await documentText(await getObject(file.storageKey), file.mimeType);
  const reading = extractTransferNote(text);
  const registration = englandRegistration(reading.carrierRegistration);
  const registerCheck = registration ? await lookupCarrier(registration) : undefined;
  const stored = { ...reading, method, ...(registerCheck && registerCheck.status !== "unavailable" ? { registerCheck } : {}) };
  await prisma.wasteDocument.update({ where: { id }, data: { extracted: stored } });
  return { doc, reading: stored as TransferNoteReading & typeof stored, fill: suggestedFill(doc.kind, doc, reading) };
}
