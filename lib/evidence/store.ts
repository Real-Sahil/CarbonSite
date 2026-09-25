import { createHash } from "crypto";
import { prisma } from "@/lib/db";
import { keys, putObject } from "@/lib/storage";

/**
 * Stores an uploaded file as the organisation's evidence, reusing an
 * identical file already stored (same checksum). Returns the evidence id.
 */
export async function storeEvidenceFile(orgId: string, userId: string, file: { name: string; type: string; buffer: Buffer }) {
  const checksum = createHash("sha256").update(file.buffer).digest("hex");
  const existing = await prisma.evidenceFile.findFirst({
    where: { organizationId: orgId, checksum },
    select: { id: true, storageKey: true, mimeType: true },
  });
  if (existing && existing.storageKey && existing.storageKey !== "pending") return { id: existing.id, duplicate: true };

  const evidence = await prisma.evidenceFile.create({
    data: {
      organizationId: orgId,
      filename: file.name,
      mimeType: file.type,
      byteSize: file.buffer.length,
      storageKey: "pending",
      checksum,
      uploadedByUserId: userId,
      virusScanStatus: "skipped",
      scanTimestamp: new Date(),
      scanProvider: "none",
    },
  });
  const storageKey = keys.evidence(orgId, evidence.id, file.name);
  await putObject(storageKey, file.buffer, file.type);
  await prisma.evidenceFile.update({ where: { id: evidence.id }, data: { storageKey } });
  return { id: evidence.id, duplicate: false };
}
