import { createHash } from "node:crypto";
import { prisma } from "@/lib/db";
import { getObject } from "@/lib/storage";
import { writeAuditLog } from "@/lib/db/audit";
import { canonicalJson } from "@/lib/audit/chain";

// Evidence seals. An approved activity record is sealed: its figures, the
// SHA-256 of every evidence file behind it, what the device reported at
// capture and who approved it are hashed together, and the hash is written
// into the audit log's hash chain (`record.sealed`). Changing the record, a
// file or the seal row afterwards no longer matches. A seal proves nothing was
// altered after capture; it cannot prove the photograph was honest when taken.

export const SEAL_VERSION = 1;

export type SealEvidence = { id: string; sha256: string; bytes: number; mime: string; verified: boolean };
export type SealPayload = {
  v: number;
  recordId: string;
  submissionId: string | null;
  amount: string;
  unit: string;
  activityDate: string | null;
  supplierName: string | null;
  sourceDescription: string | null;
  fuelType: string | null;
  facilityId: string | null;
  siteId: string | null;
  contractId: string | null;
  evidence: SealEvidence[];
  capture: { deviceSubmittedAt: string | null; gpsLat: string | null; gpsLng: string | null; ocrSha256: string | null } | null;
  sealedBy: string | null;
  sealedAt: string;
  previousSealHash: string | null;
};

export const sha256 = (b: Buffer | string) => createHash("sha256").update(b).digest("hex");
export const sealHashOf = (p: SealPayload) => sha256(canonicalJson(p));

/** Reads the stored bytes back and compares their SHA-256 with the checksum on file. */
export async function verifyEvidenceBytes(file: { id: string; storageKey: string; checksum: string; verifiedAt: Date | null }): Promise<"match" | "mismatch" | "unreadable"> {
  if (!file.storageKey || file.storageKey === "pending") return "unreadable";
  let buf: Buffer;
  try {
    buf = await getObject(file.storageKey);
  } catch {
    return "unreadable";
  }
  if (sha256(buf) !== file.checksum.toLowerCase()) return "mismatch";
  if (!file.verifiedAt) await prisma.evidenceFile.updateMany({ where: { id: file.id }, data: { verifiedAt: new Date() } });
  return "match";
}

const dec = (v: { toString(): string } | null) => (v == null ? null : v.toString());
const day = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null);

export type SealOutcome = { ok: true; version: number; sealHash: string; evidenceCount: number; unverified: number } | { ok: false; reason: string };

/**
 * Seals the record as it stands now. A second seal links to the first. Evidence whose bytes no
 * longer match their checksum stops the seal: the file was changed after upload.
 */
export async function sealRecord(orgId: string, recordId: string, actorUserId: string | null, opts: { submissionId?: string | null } = {}): Promise<SealOutcome> {
  const record = await prisma.activityRecord.findFirst({
    where: { id: recordId, organizationId: orgId },
    select: {
      id: true, amount: true, unit: true, activityDate: true, supplierName: true, sourceDescription: true, fuelType: true, facilityId: true, siteId: true, contractId: true,
      fieldSubmissionId: true,
      evidence: { select: { evidenceFile: { select: { id: true, checksum: true, byteSize: true, mimeType: true, storageKey: true, verifiedAt: true } } } },
    },
  });
  if (!record) return { ok: false, reason: "Record not found." };
  const files = record.evidence.map((e) => e.evidenceFile).sort((a, b) => (a.id < b.id ? -1 : 1));
  const evidence: SealEvidence[] = [];
  for (const f of files) {
    const r = await verifyEvidenceBytes(f);
    if (r === "mismatch") return { ok: false, reason: `Evidence file ${f.id} no longer matches its recorded SHA-256. It was changed after upload.` };
    evidence.push({ id: f.id, sha256: f.checksum.toLowerCase(), bytes: f.byteSize, mime: f.mimeType, verified: r === "match" });
  }

  const submissionId = opts.submissionId ?? record.fieldSubmissionId ?? null;
  const sub = submissionId
    ? await prisma.fieldSubmission.findFirst({
        where: { id: submissionId, organizationId: orgId },
        select: { deviceSubmittedAt: true, gpsLat: true, gpsLng: true, ocrExtractedData: true },
      })
    : null;
  const previous = await prisma.recordSeal.findFirst({ where: { organizationId: orgId, activityRecordId: recordId }, orderBy: { version: "desc" }, select: { version: true, sealHash: true } });
  const sealedAt = new Date();
  const payload: SealPayload = {
    v: SEAL_VERSION, recordId, submissionId,
    amount: record.amount.toString(), unit: record.unit, activityDate: day(record.activityDate), supplierName: record.supplierName, sourceDescription: record.sourceDescription,
    fuelType: record.fuelType, facilityId: record.facilityId, siteId: record.siteId, contractId: record.contractId, evidence,
    capture: sub ? { deviceSubmittedAt: sub.deviceSubmittedAt?.toISOString() ?? null, gpsLat: dec(sub.gpsLat), gpsLng: dec(sub.gpsLng), ocrSha256: sub.ocrExtractedData ? sha256(canonicalJson(sub.ocrExtractedData)) : null } : null,
    sealedBy: actorUserId, sealedAt: sealedAt.toISOString(), previousSealHash: previous?.sealHash ?? null,
  };
  const sealHash = sealHashOf(payload);
  const version = (previous?.version ?? 0) + 1;
  await prisma.recordSeal.create({ data: { organizationId: orgId, activityRecordId: recordId, version, sealHash, previousSealHash: payload.previousSealHash, payload: payload as never, sealedByUserId: actorUserId, sealedAt } });
  await writeAuditLog({
    organizationId: orgId, actorUserId, action: "record.sealed", resourceType: "activity_record", resourceId: recordId,
    metadata: { sealHash, version, evidence: evidence.map((e) => ({ id: e.id, sha256: e.sha256 })) },
  });
  return { ok: true, version, sealHash, evidenceCount: evidence.length, unverified: evidence.filter((e) => !e.verified).length };
}

export type SealCurrent = {
  amount: string; unit: string; activityDate: string | null; supplierName: string | null; sourceDescription: string | null; fuelType: string | null;
  facilityId: string | null; siteId: string | null; contractId: string | null; evidence: { id: string; sha256: string }[];
};

/** What differs between a seal and the record and files as they stand now. Empty means unchanged. */
export function sealDifferences(p: SealPayload, now: SealCurrent): string[] {
  const out: string[] = [];
  const same = (label: string, a: unknown, b: unknown) => { if (String(a ?? "") !== String(b ?? "")) out.push(`${label} changed`); };
  // Decimals print with trailing zeros differently; compare as numbers.
  if (Number(p.amount) !== Number(now.amount)) out.push("amount changed");
  same("unit", p.unit, now.unit); same("date", p.activityDate, now.activityDate); same("supplier", p.supplierName, now.supplierName);
  same("description", p.sourceDescription, now.sourceDescription); same("fuel type", p.fuelType, now.fuelType);
  same("facility", p.facilityId, now.facilityId); same("site", p.siteId, now.siteId); same("contract", p.contractId, now.contractId);
  const was = new Map(p.evidence.map((e) => [e.id, e.sha256]));
  const is = new Map(now.evidence.map((e) => [e.id, e.sha256]));
  for (const [id, h] of was) {
    if (!is.has(id)) out.push(`evidence ${id} removed`);
    else if (is.get(id) !== h) out.push(`evidence ${id} changed`);
  }
  for (const id of is.keys()) if (!was.has(id)) out.push(`evidence ${id} added`);
  return out;
}

/** The first of these evidence files whose stored bytes no longer match their recorded SHA-256, or null. Files that cannot be read are not counted as mismatches. */
export async function firstEvidenceMismatch(orgId: string, evidenceIds: string[]): Promise<string | null> {
  if (!evidenceIds.length) return null;
  const files = await prisma.evidenceFile.findMany({ where: { id: { in: evidenceIds }, organizationId: orgId }, select: { id: true, storageKey: true, checksum: true, verifiedAt: true } });
  for (const f of files) {
    if ((await verifyEvidenceBytes(f)) === "mismatch") {
      await writeAuditLog({ organizationId: orgId, actorUserId: null, action: "evidence.checksum_mismatch", resourceType: "evidence_file", resourceId: f.id, metadata: { expected: f.checksum } });
      return f.id;
    }
  }
  return null;
}

/** Seals a record just approved. Never throws: the approval stands, and a failure is logged. */
export async function sealAfterApproval(orgId: string, recordId: string | null, submissionId: string, actorUserId: string) {
  if (!recordId) return;
  try {
    const r = await sealRecord(orgId, recordId, actorUserId, { submissionId });
    if (!r.ok) console.error("[evidence] seal failed", recordId, r.reason);
  } catch (err) {
    console.error("[evidence] seal failed", recordId, err);
  }
}
