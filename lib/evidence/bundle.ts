import { prisma } from "@/lib/db";
import { VERIFY_EVIDENCE_SCRIPT } from "./verify-script";

export type ManifestFile = { path: string; evidenceId: string; sha256: string; bytes: number };
export type ManifestSeal = { recordId: string; version: number; sealHash: string; sealedAt: string; payload: unknown };

/** The seals for these records, oldest first, in the form evidence-manifest.json carries them. */
export async function loadManifestSeals(orgId: string, recordIds: string[]): Promise<ManifestSeal[]> {
  const out: ManifestSeal[] = [];
  const PAGE = 500;
  for (let i = 0; i < recordIds.length; i += PAGE) {
    const rows = await prisma.recordSeal.findMany({
      where: { organizationId: orgId, activityRecordId: { in: recordIds.slice(i, i + PAGE) } },
      orderBy: [{ activityRecordId: "asc" }, { version: "asc" }],
      select: { activityRecordId: true, version: true, sealHash: true, sealedAt: true, payload: true },
    });
    for (const r of rows) out.push({ recordId: r.activityRecordId, version: r.version, sealHash: r.sealHash, sealedAt: r.sealedAt.toISOString(), payload: r.payload });
  }
  return out;
}

export function evidenceManifestJson(organisationId: string, files: ManifestFile[], seals: ManifestSeal[]): string {
  return JSON.stringify({ version: 1, organisationId, generatedAt: new Date().toISOString(), files, seals }, null, 2) + "\n";
}

export { VERIFY_EVIDENCE_SCRIPT };
