/**
 * Assurance pack: everything an assurance provider asks for on a published
 * snapshot, in one ZIP.
 *
 *   README.txt           what the snapshot is, the libraries and methodology, evidence split
 *   calculations.csv     every calculation in the snapshot's run, with record, factor, formula,
 *                        selection reason, warnings, provenance and evidence tier
 *   factors.csv          each emission factor the run used (library and organisation factors)
 *   evidence-index.csv   every evidence file on those records, its SHA-256, and whether it is included
 *   evidence/            the files themselves, up to MAX_EVIDENCE_BYTES in total
 *   samples.csv          the engagement's sample and test results (when an engagement is given)
 *   audit-log.csv        the organisation's audit trail from the period start, with its hash chain
 *   manifest.sha256      SHA-256 of every other file in the pack
 *
 * Figures come from the stored immutable calculations; nothing is recalculated.
 */
import { createHash } from "crypto";
import type { Archiver } from "archiver";
import { prisma } from "@/lib/db";
import { getObject } from "@/lib/storage";
import { evidenceTier, EVIDENCE_TIER_LABEL, EVIDENCE_TIER_ORDER, summariseTiers } from "@/lib/data-quality/evidence-tier";
import { countsTowardHeadline, scope2MethodOf } from "@/lib/calculation/scope2-method";

export const MAX_EVIDENCE_BYTES = 200 * 1024 * 1024;
const MAX_AUDIT_ROWS = 50_000;
const PAGE = 2_000;

export function csvCell(v: unknown): string {
  if (v == null) return "";
  const isDecimal = typeof v === "object" && typeof (v as { toFixed?: unknown }).toFixed === "function";
  const s = v instanceof Date ? v.toISOString() : typeof v === "object" && !isDecimal ? JSON.stringify(v) : String(v);
  // Neutralise spreadsheet formulas in text taken from users or documents.
  const safe = /^[=+\-@\t\r]/.test(s) && !/^-?\d/.test(s) ? `'${s}` : s;
  return /[",\n\r]/.test(safe) ? `"${safe.replaceAll('"', '""')}"` : safe;
}

export function csvLine(values: unknown[]): string {
  return values.map(csvCell).join(",") + "\n";
}

/** Keeps a file name safe inside the ZIP (no paths, no control characters). */
export function zipSafeName(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? "file";
  return base.replace(/[^\w.\- ()]/g, "_").slice(0, 120) || "file";
}

type Entry = { name: string; sha256: string };

export async function writeAssurancePack(
  archive: Archiver,
  opts: { orgId: string; snapshotId: string; engagementId?: string | null; generatedBy: string },
): Promise<{ files: number; evidenceIncluded: number; evidenceSkipped: number }> {
  const manifest: Entry[] = [];
  const add = (name: string, body: string | Buffer, sha256?: string) => {
    const buf = typeof body === "string" ? Buffer.from(body, "utf8") : body;
    manifest.push({ name, sha256: sha256 ?? createHash("sha256").update(buf).digest("hex") });
    archive.append(buf, { name });
  };

  const snapshot = await prisma.publishedSnapshot.findFirst({
    where: { id: opts.snapshotId, organizationId: opts.orgId },
    select: {
      id: true,
      version: true,
      publishedAt: true,
      calculationRunId: true,
      organization: { select: { name: true } },
      reportingPeriod: { select: { label: true, startDate: true, endDate: true } },
      calculationRun: {
        select: {
          id: true,
          createdAt: true,
          factorLibrary: { select: { name: true, version: true, license: true } },
          methodologyVersion: { select: { name: true, gwpVersion: true } },
        },
      },
    },
  });
  if (!snapshot) throw new PackError("Snapshot not found.");

  // calculations.csv, streamed page by page
  const factorIds = new Set<string>();
  const orgFactorIds = new Set<string>();
  const recordIds: string[] = [];
  const tierRows: Parameters<typeof summariseTiers>[0] = [];
  let calcCsv = csvLine([
    "calculation_id", "activity_record_id", "scope", "scope2_method", "counts_in_headline", "category_code", "category_name",
    "facility", "site", "activity_date", "start_date", "end_date", "supplier", "source_description",
    "original_amount", "original_unit", "normalized_amount", "normalized_unit",
    "factor_source", "factor_id", "factor_library_version", "factor_value", "selection_reason", "formula",
    "co2_kg", "ch4_kg_co2e", "n2o_kg_co2e", "biogenic_co2_kg", "total_kg_co2e", "warnings",
    "data_origin", "data_origin_note", "review_status", "evidence_status", "evidence_tier", "evidence_files",
  ]);
  let cursor: string | undefined;
  for (;;) {
    const page = await prisma.emissionCalculation.findMany({
      where: { organizationId: opts.orgId, calculationRunId: snapshot.calculationRunId },
      orderBy: { id: "asc" },
      take: PAGE,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      select: {
        id: true,
        emissionFactorId: true,
        organizationEmissionFactorId: true,
        factorLibraryVersion: true,
        factorValue: true,
        selectionReason: true,
        formula: true,
        originalAmount: true,
        originalUnit: true,
        normalizedAmount: true,
        normalizedUnit: true,
        co2: true,
        ch4: true,
        n2o: true,
        biogenicCo2e: true,
        totalCo2e: true,
        warnings: true,
        activityRecord: {
          select: {
            id: true,
            scope2Method: true,
            activityDate: true,
            startDate: true,
            endDate: true,
            supplierName: true,
            sourceDescription: true,
            dataOrigin: true,
            dataOriginNote: true,
            reviewStatus: true,
            evidenceStatus: true,
            emissionCategory: { select: { code: true, name: true, scope: true } },
            facility: { select: { name: true } },
            site: { select: { name: true } },
            evidence: { select: { evidenceFile: { select: { filename: true } } } },
          },
        },
      },
    });
    if (!page.length) break;
    for (const c of page) {
      const r = c.activityRecord;
      const method = r.emissionCategory.scope === 2 ? scope2MethodOf(r) : null;
      const headline = countsTowardHeadline(method);
      if (c.emissionFactorId) factorIds.add(c.emissionFactorId);
      if (c.organizationEmissionFactorId) orgFactorIds.add(c.organizationEmissionFactorId);
      recordIds.push(r.id);
      if (headline) tierRows.push({ dataOrigin: r.dataOrigin, evidenceStatus: r.evidenceStatus, reviewStatus: r.reviewStatus, totalCo2e: Number(c.totalCo2e) });
      calcCsv += csvLine([
        c.id, r.id, r.emissionCategory.scope, method ?? "", headline ? "yes" : "no", r.emissionCategory.code, r.emissionCategory.name,
        r.facility?.name, r.site?.name, r.activityDate?.toISOString().slice(0, 10), r.startDate?.toISOString().slice(0, 10), r.endDate?.toISOString().slice(0, 10),
        r.supplierName, r.sourceDescription,
        c.originalAmount, c.originalUnit, c.normalizedAmount, c.normalizedUnit,
        c.organizationEmissionFactorId ? "organisation" : c.emissionFactorId ? "library" : "none", c.organizationEmissionFactorId ?? c.emissionFactorId,
        c.factorLibraryVersion, c.factorValue, c.selectionReason, c.formula,
        c.co2, c.ch4, c.n2o, c.biogenicCo2e, c.totalCo2e,
        Array.isArray(c.warnings) && c.warnings.length ? (c.warnings as unknown[]).map(String).join(" | ") : "",
        r.dataOrigin, r.dataOriginNote, r.reviewStatus, r.evidenceStatus, EVIDENCE_TIER_LABEL[evidenceTier(r)],
        r.evidence.map((e) => e.evidenceFile.filename).join("; "),
      ]);
    }
    cursor = page[page.length - 1].id;
  }
  add("calculations.csv", calcCsv);

  // factors.csv
  let factorCsv = csvLine(["factor_source", "factor_id", "library", "scope", "category_code", "activity_type", "country", "region", "effective_start", "effective_end", "input_unit", "co2", "ch4", "n2o", "co2e", "biogenic_co2", "price_base_year", "usage_notes", "organisation_factor_source", "organisation_factor_version"]);
  const libFactors = factorIds.size
    ? await prisma.emissionFactor.findMany({
        where: { id: { in: [...factorIds] } },
        select: {
          id: true, scope: true, activityType: true, geographyCountry: true, geographyRegion: true, effectiveStartDate: true, effectiveEndDate: true,
          inputUnit: true, co2: true, ch4: true, n2o: true, co2e: true, biogenicCo2: true, priceBaseYear: true, usageNotes: true,
          emissionCategory: { select: { code: true } }, factorLibrary: { select: { name: true, version: true } },
        },
      })
    : [];
  for (const f of libFactors) {
    factorCsv += csvLine(["library", f.id, `${f.factorLibrary.name} ${f.factorLibrary.version}`, f.scope, f.emissionCategory?.code, f.activityType, f.geographyCountry, f.geographyRegion,
      f.effectiveStartDate?.toISOString().slice(0, 10), f.effectiveEndDate?.toISOString().slice(0, 10), f.inputUnit, f.co2, f.ch4, f.n2o, f.co2e, f.biogenicCo2, f.priceBaseYear, f.usageNotes, "", ""]);
  }
  const orgFactors = orgFactorIds.size
    ? await prisma.organizationEmissionFactor.findMany({
        where: { id: { in: [...orgFactorIds] }, organizationId: opts.orgId },
        select: {
          id: true, scope: true, activityType: true, geographyCountry: true, geographyRegion: true, effectiveStartDate: true, effectiveEndDate: true,
          inputUnit: true, co2: true, ch4: true, n2o: true, co2e: true, priceBaseYear: true, usageNotes: true, source: true, version: true,
          emissionCategory: { select: { code: true } },
        },
      })
    : [];
  for (const f of orgFactors) {
    factorCsv += csvLine(["organisation", f.id, "Organisation factor", f.scope, f.emissionCategory?.code, f.activityType, f.geographyCountry, f.geographyRegion,
      f.effectiveStartDate?.toISOString().slice(0, 10), f.effectiveEndDate?.toISOString().slice(0, 10), f.inputUnit, f.co2, f.ch4, f.n2o, f.co2e, "", f.priceBaseYear, f.usageNotes, f.source, f.version]);
  }
  add("factors.csv", factorCsv);

  // evidence-index.csv and evidence/
  let evidenceCsv = csvLine(["evidence_id", "filename", "mime_type", "bytes", "sha256", "uploaded_at", "activity_record_ids", "included_as"]);
  let evidenceBytes = 0;
  let evidenceIncluded = 0;
  let evidenceSkipped = 0;
  const usedNames = new Set<string>();
  for (let i = 0; i < recordIds.length; i += PAGE) {
    const links = await prisma.activityRecordEvidence.findMany({
      where: { organizationId: opts.orgId, activityRecordId: { in: recordIds.slice(i, i + PAGE) } },
      select: { activityRecordId: true, evidenceFile: { select: { id: true, filename: true, mimeType: true, byteSize: true, checksum: true, storageKey: true, createdAt: true } } },
    });
    const byFile = new Map<string, { file: (typeof links)[number]["evidenceFile"]; records: string[] }>();
    for (const l of links) {
      const e = byFile.get(l.evidenceFile.id) ?? { file: l.evidenceFile, records: [] };
      e.records.push(l.activityRecordId);
      byFile.set(l.evidenceFile.id, e);
    }
    for (const { file, records } of byFile.values()) {
      let includedAs = "";
      if (evidenceBytes + file.byteSize <= MAX_EVIDENCE_BYTES && file.storageKey && file.storageKey !== "pending") {
        try {
          const buf = await getObject(file.storageKey);
          let name = `evidence/${file.id}-${zipSafeName(file.filename)}`;
          while (usedNames.has(name)) name = `${name}_`;
          usedNames.add(name);
          add(name, buf, file.checksum || undefined);
          evidenceBytes += buf.length;
          evidenceIncluded++;
          includedAs = name;
        } catch {
          evidenceSkipped++;
          includedAs = "not included: could not be read from storage";
        }
      } else {
        evidenceSkipped++;
        includedAs = "not included: pack size limit reached";
      }
      evidenceCsv += csvLine([file.id, file.filename, file.mimeType, file.byteSize, file.checksum, file.createdAt, records.join(" "), includedAs]);
    }
  }
  add("evidence-index.csv", evidenceCsv);

  // samples.csv
  if (opts.engagementId) {
    const samples = await prisma.assuranceSample.findMany({
      where: { organizationId: opts.orgId, engagementId: opts.engagementId },
      orderBy: { createdAt: "asc" },
      select: {
        id: true, emissionCalculationId: true, activityRecordId: true, waterRecordId: true, wasteRecordId: true,
        samplingMethod: true, selectionRationale: true, testProcedure: true, result: true, testedAt: true, testNotes: true, supportingEvidenceId: true,
      },
    });
    let sampleCsv = csvLine(["sample_id", "emission_calculation_id", "activity_record_id", "water_record_id", "waste_record_id", "sampling_method", "selection_rationale", "test_procedure", "result", "tested_at", "test_notes", "supporting_evidence_id"]);
    for (const s of samples) {
      sampleCsv += csvLine([s.id, s.emissionCalculationId, s.activityRecordId, s.waterRecordId, s.wasteRecordId, s.samplingMethod, s.selectionRationale, s.testProcedure, s.result, s.testedAt, s.testNotes, s.supportingEvidenceId]);
    }
    add("samples.csv", sampleCsv);
  }

  // audit-log.csv, oldest first so the hash chain reads in order
  let auditCsv = csvLine(["chain_seq", "created_at", "actor_user_id", "action", "resource_type", "resource_id", "metadata", "previous_hash", "hash"]);
  let auditRows = 0;
  let seq: bigint | undefined;
  while (auditRows < MAX_AUDIT_ROWS) {
    const rows = await prisma.auditLog.findMany({
      where: { organizationId: opts.orgId, createdAt: { gte: snapshot.reportingPeriod.startDate }, ...(seq != null ? { chainSeq: { gt: seq } } : {}) },
      orderBy: { chainSeq: "asc" },
      take: PAGE,
      select: { chainSeq: true, createdAt: true, actorUserId: true, action: true, resourceType: true, resourceId: true, metadata: true, previousHash: true, hash: true },
    });
    if (!rows.length) break;
    for (const a of rows) auditCsv += csvLine([a.chainSeq.toString(), a.createdAt, a.actorUserId, a.action, a.resourceType, a.resourceId, a.metadata, a.previousHash, a.hash]);
    auditRows += rows.length;
    seq = rows[rows.length - 1].chainSeq;
  }
  add("audit-log.csv", auditCsv);

  // README.txt
  const split = summariseTiers(tierRows);
  const run = snapshot.calculationRun;
  const readme = [
    `Assurance pack: ${snapshot.organization.name}`,
    ``,
    `Reporting period: ${snapshot.reportingPeriod.label} (${snapshot.reportingPeriod.startDate.toISOString().slice(0, 10)} to ${snapshot.reportingPeriod.endDate.toISOString().slice(0, 10)})`,
    `Published snapshot: version ${snapshot.version}, published ${snapshot.publishedAt.toISOString()}, id ${snapshot.id}`,
    `Calculation run: ${run.id}, run ${run.createdAt.toISOString()}`,
    `Factor library: ${run.factorLibrary.name} ${run.factorLibrary.version}${run.factorLibrary.license ? ` (${run.factorLibrary.license})` : ""}. Organisation factors used: ${orgFactors.length}. See factors.csv.`,
    `Methodology: ${run.methodologyVersion.name}, GWP ${run.methodologyVersion.gwpVersion}`,
    `Generated: ${new Date().toISOString()} by user ${opts.generatedBy}${opts.engagementId ? `, for assurance engagement ${opts.engagementId}` : ""}`,
    ``,
    `Evidence behind the headline figures (location-based Scope 2; market-based rows are listed but not counted):`,
    ...EVIDENCE_TIER_ORDER.map((t) => `  ${EVIDENCE_TIER_LABEL[t]}: ${split[t].records} records, ${(split[t].co2e / 1000).toFixed(2)} tCO2e, ${split[t].percent.toFixed(1)}%`),
    `  Verified: primary data (metered, invoiced or supplier-specific) with evidence attached and approved in review. Partially verified: one of those missing. Estimated: the rest.`,
    ``,
    `Files:`,
    `  calculations.csv    ${recordIds.length} calculations, one per record in the run`,
    `  factors.csv         ${libFactors.length} library and ${orgFactors.length} organisation factors`,
    `  evidence-index.csv  every evidence file on these records with its SHA-256`,
    `  evidence/           ${evidenceIncluded} files included${evidenceSkipped ? `, ${evidenceSkipped} listed but not included (see evidence-index.csv)` : ""}`,
    ...(opts.engagementId ? [`  samples.csv         the engagement's sample and test results`] : []),
    `  audit-log.csv       ${auditRows} audit entries from the period start${auditRows >= MAX_AUDIT_ROWS ? ` (first ${MAX_AUDIT_ROWS})` : ""}, with hash chain`,
    `  manifest.sha256     SHA-256 of every file above`,
    ``,
    `Stored calculations are immutable; nothing in this pack was recalculated.`,
    ``,
  ].join("\n");
  add("README.txt", readme);

  const manifestText = manifest.map((m) => `${m.sha256}  ${m.name}`).join("\n") + "\n";
  archive.append(manifestText, { name: "manifest.sha256" });

  return { files: manifest.length + 1, evidenceIncluded, evidenceSkipped };
}

export class PackError extends Error {}
