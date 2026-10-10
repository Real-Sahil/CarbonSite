import type { Archiver } from "archiver";
import { prisma } from "@/lib/db";
import { getObject } from "@/lib/storage";
import { csvLine, zipSafeName } from "@/lib/assurance/pack";
import { evidenceManifestJson, loadManifestSeals, type ManifestFile } from "./bundle";
import { sealDifferences, sha256, type SealPayload } from "./seal";
import { VERIFY_EVIDENCE_SCRIPT } from "./verify-script";

const MAX_BUNDLE_BYTES = 100 * 1024 * 1024;

export type SealStatus = {
  sealed: boolean;
  latest: { version: number; sealHash: string; sealedAt: Date; sealedByUserId: string | null; evidenceCount: number } | null;
  /** What differs between the latest seal and the record and files as they stand now. */
  changes: string[];
  versions: number;
};

export async function recordSealStatus(orgId: string, recordId: string): Promise<SealStatus | null> {
  const record = await prisma.activityRecord.findFirst({
    where: { id: recordId, organizationId: orgId },
    select: {
      amount: true, unit: true, activityDate: true, supplierName: true, sourceDescription: true, fuelType: true, facilityId: true, siteId: true, contractId: true,
      evidence: { select: { evidenceFile: { select: { id: true, checksum: true } } } },
    },
  });
  if (!record) return null;
  const seals = await prisma.recordSeal.findMany({ where: { organizationId: orgId, activityRecordId: recordId }, orderBy: { version: "desc" }, take: 1, select: { version: true, sealHash: true, sealedAt: true, sealedByUserId: true, payload: true } });
  const count = await prisma.recordSeal.count({ where: { organizationId: orgId, activityRecordId: recordId } });
  const latest = seals[0];
  if (!latest) return { sealed: false, latest: null, changes: [], versions: 0 };
  const payload = latest.payload as unknown as SealPayload;
  const changes = sealDifferences(payload, {
    amount: record.amount.toString(), unit: record.unit, activityDate: record.activityDate ? record.activityDate.toISOString().slice(0, 10) : null,
    supplierName: record.supplierName, sourceDescription: record.sourceDescription, fuelType: record.fuelType,
    facilityId: record.facilityId, siteId: record.siteId, contractId: record.contractId,
    evidence: record.evidence.map((e) => ({ id: e.evidenceFile.id, sha256: e.evidenceFile.checksum.toLowerCase() })),
  });
  return { sealed: true, latest: { version: latest.version, sealHash: latest.sealHash, sealedAt: latest.sealedAt, sealedByUserId: latest.sealedByUserId, evidenceCount: payload.evidence.length }, changes, versions: count };
}

/**
 * One record's evidence bundle: the files as stored, the seals, the audit entries about the record,
 * its submission and its files, and verify-evidence.mjs to check them on any machine.
 */
export async function writeRecordBundle(archive: Archiver, orgId: string, recordId: string): Promise<{ files: number; skipped: number } | null> {
  const record = await prisma.activityRecord.findFirst({
    where: { id: recordId, organizationId: orgId },
    select: {
      id: true, amount: true, unit: true, activityDate: true, supplierName: true, sourceDescription: true, reviewStatus: true, fieldSubmissionId: true,
      evidence: { select: { evidenceFile: { select: { id: true, filename: true, mimeType: true, byteSize: true, checksum: true, storageKey: true, createdAt: true, verifiedAt: true } } } },
    },
  });
  if (!record) return null;

  const files: ManifestFile[] = [];
  let bytes = 0;
  let skipped = 0;
  let index = "evidence_id,filename,mime_type,bytes,recorded_sha256,actual_sha256,matches,verified_by_server_at,included_as\n";
  const used = new Set<string>();
  for (const { evidenceFile: f } of record.evidence) {
    let includedAs = "";
    let actual = "";
    if (bytes + f.byteSize <= MAX_BUNDLE_BYTES && f.storageKey && f.storageKey !== "pending") {
      try {
        const buf = await getObject(f.storageKey);
        actual = sha256(buf);
        let name = `evidence/${f.id}-${zipSafeName(f.filename)}`;
        while (used.has(name)) name += "_";
        used.add(name);
        archive.append(buf, { name });
        bytes += buf.length;
        // The manifest carries the hash of the bytes in the bundle, not the one on file, so a
        // file whose bytes differ from its recorded checksum shows up at the seal check.
        files.push({ path: name, evidenceId: f.id, sha256: actual, bytes: buf.length });
        includedAs = name;
      } catch {
        skipped++;
        includedAs = "not included: could not be read from storage";
      }
    } else {
      skipped++;
      includedAs = "not included: bundle size limit reached";
    }
    index += csvLine([f.id, f.filename, f.mimeType, f.byteSize, f.checksum, actual, actual ? String(actual === f.checksum.toLowerCase()) : "", f.verifiedAt?.toISOString() ?? "", includedAs]);
  }
  archive.append(index, { name: "evidence-index.csv" });

  const seals = await loadManifestSeals(orgId, [recordId]);
  archive.append(evidenceManifestJson(orgId, files, seals), { name: "evidence-manifest.json" });

  // Audit entries about this record, its submission and its files, oldest first. They are not a
  // contiguous run of the chain, so each is checked on its own contents; verify-audit-log.mjs from
  // an assurance pack checks the whole chain.
  const resourceIds = [recordId, ...(record.fieldSubmissionId ? [record.fieldSubmissionId] : []), ...record.evidence.map((e) => e.evidenceFile.id)];
  const rows = await prisma.auditLog.findMany({
    where: { organizationId: orgId, resourceId: { in: resourceIds } },
    orderBy: { chainSeq: "asc" },
    take: 2000,
    select: { chainSeq: true, createdAt: true, actorUserId: true, action: true, resourceType: true, resourceId: true, metadata: true, previousHash: true, hash: true, hashVersion: true, redactedAt: true },
  });
  let audit = csvLine(["chain_seq", "created_at", "actor_user_id", "action", "resource_type", "resource_id", "metadata", "previous_hash", "hash", "hash_version", "redacted_at"]);
  for (const a of rows) audit += csvLine([a.chainSeq.toString(), a.createdAt, a.actorUserId, a.action, a.resourceType, a.resourceId, a.metadata, a.previousHash, a.hash, a.hashVersion, a.redactedAt]);
  archive.append(audit, { name: "audit-log.csv" });
  archive.append(VERIFY_EVIDENCE_SCRIPT, { name: "verify-evidence.mjs" });

  archive.append(
    [
      `Evidence bundle for activity record ${record.id}`,
      `Organisation id: ${orgId}`,
      `Generated: ${new Date().toISOString()}`,
      ``,
      `Record: ${record.amount.toString()} ${record.unit}${record.activityDate ? ` on ${record.activityDate.toISOString().slice(0, 10)}` : ""}${record.supplierName ? `, ${record.supplierName}` : ""}. Review status: ${record.reviewStatus}.`,
      `Seals: ${seals.length}. ${seals.length ? "Each seal fixes the record's figures, the SHA-256 of every evidence file, what the device reported at capture, and the reviewer, and its hash is written into the audit trail." : "This record has not been sealed."}`,
      ``,
      `To check it on your machine, unzip and run, in this folder:`,
      `  node verify-evidence.mjs`,
      `It compares every file with its SHA-256, recomputes each seal, and checks that each seal appears in audit-log.csv.`,
      ``,
      `What this shows: the files and the record were not changed after they were sealed. What it does not show: that the photograph was honest when taken. The capture time and position come from the device.`,
      ``,
    ].join("\n"),
    { name: "README.txt" },
  );
  return { files: files.length, skipped };
}
