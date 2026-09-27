import { createHash } from "crypto";
import type { Archiver } from "archiver";
import { prisma } from "@/lib/db";
import { getObject } from "@/lib/storage";
import { csvLine, zipSafeName } from "@/lib/assurance/pack";
import { getFramework, headingCodes, type CatalogueFramework } from "./catalogue";
import { REGISTERS, REGISTER_KEYS, type RegisterKey } from "./registers/config";
import { delegate } from "./registers/server";
import { trainingMatrix } from "./training";

// The certification pack: what a certification body asks for at a stage 1
// or stage 2 audit, for the frameworks chosen, in one ZIP. Requirement
// status with evidence per framework, a Statement of Applicability for
// standards with Annex A controls, every register (rows tagged with other
// frameworks only are left out), the training matrix, the files behind them
// and a SHA-256 manifest. Nothing is generated or summarised: it is the
// organisation's own records.

export const MAX_PACK_EVIDENCE_BYTES = 200 * 1024 * 1024;
const REGISTER_FILE_FIELDS = (Object.keys(REGISTERS) as RegisterKey[]).flatMap((k) => REGISTERS[k].fields.filter((f) => f.type === "file").map((f) => ({ key: k, field: f.name })));

type Row = Record<string, unknown> & { id: string };

/** A register row belongs in a pack for `frameworks` unless it is tagged only with other frameworks. */
export function rowInScope(row: Row, frameworks: string[]): boolean {
  const tagged = row.frameworks as string[] | undefined;
  return !Array.isArray(tagged) || tagged.length === 0 || tagged.some((f) => frameworks.includes(f));
}

/**
 * Evidence files the pack for these frameworks draws on: files linked to
 * their requirements and files attached to in-scope register rows. The
 * auditor link may download exactly these and nothing else.
 */
export async function packEvidenceFileIds(orgId: string, frameworks: string[]): Promise<Set<string>> {
  const ids = new Set<string>();
  const links = await prisma.msEvidenceLink.findMany({
    where: { organizationId: orgId, frameworkSlug: { in: frameworks }, kind: "evidence_file", targetId: { not: null } },
    select: { targetId: true },
  });
  for (const l of links) ids.add(l.targetId!);
  for (const { key, field } of REGISTER_FILE_FIELDS) {
    const rows = await delegate(key).findMany({ where: { organizationId: orgId, [field]: { not: null } }, take: 5000 });
    for (const r of rows) if (rowInScope(r, frameworks)) ids.add(String(r[field]));
  }
  return ids;
}

export type SoaRow = { code: string; title: string; applicable: boolean; justification: string; status: string; evidence: string };

/** Statement of Applicability: every Annex A control, whether it applies and why, and how far it is implemented. */
export function statementOfApplicability(
  framework: CatalogueFramework,
  statuses: Array<{ requirementCode: string; status: string; notes: string | null; interpretation: string | null }>,
  links: Array<{ requirementCode: string; label: string }>,
): SoaRow[] {
  const headings = headingCodes(framework);
  const byCode = new Map(statuses.map((s) => [s.requirementCode, s]));
  return framework.requirements
    .filter((r) => r.tags?.includes("annex:a") && !headings.has(r.code))
    .map((r) => {
      const s = byCode.get(r.code);
      const applicable = s?.status !== "not_applicable";
      return {
        code: r.code,
        title: r.title,
        applicable,
        justification: (applicable ? s?.interpretation : s?.notes) ?? s?.notes ?? "",
        status: s?.status ?? "not_started",
        evidence: links.filter((l) => l.requirementCode === r.code).map((l) => l.label).join("; "),
      };
    });
}

const iso = (v: unknown) => (v instanceof Date ? v.toISOString().slice(0, 10) : v);

export async function writeCertificationPack(
  archive: Archiver,
  opts: { orgId: string; frameworks: string[]; generatedFor: string },
): Promise<{ files: number; evidenceIncluded: number; evidenceSkipped: number }> {
  const manifest: Array<{ name: string; sha256: string }> = [];
  const add = (name: string, body: string | Buffer, sha256?: string) => {
    const buf = typeof body === "string" ? Buffer.from(body, "utf8") : body;
    manifest.push({ name, sha256: sha256 ?? createHash("sha256").update(buf).digest("hex") });
    archive.append(buf, { name });
  };

  const org = await prisma.organization.findUnique({ where: { id: opts.orgId }, select: { name: true } });
  const [adoptions, statuses, links, members] = await Promise.all([
    prisma.msFrameworkAdoption.findMany({ where: { organizationId: opts.orgId, frameworkSlug: { in: opts.frameworks } } }),
    prisma.msRequirementStatus.findMany({ where: { organizationId: opts.orgId, frameworkSlug: { in: opts.frameworks } } }),
    prisma.msEvidenceLink.findMany({ where: { organizationId: opts.orgId, frameworkSlug: { in: opts.frameworks } }, orderBy: { createdAt: "asc" } }),
    prisma.organizationMembership.findMany({ where: { organizationId: opts.orgId }, select: { user: { select: { id: true, name: true, email: true } } } }),
  ]);
  const person = new Map(members.map((m) => [m.user.id, m.user.name || m.user.email]));
  const who = (id: unknown) => (typeof id === "string" ? (person.get(id) ?? "Former member") : "");

  const frameworkLines: string[] = [];
  for (const slug of opts.frameworks) {
    const framework = getFramework(slug);
    const adoption = adoptions.find((a) => a.frameworkSlug === slug);
    if (!framework || !adoption) continue;
    const fs = statuses.filter((s) => s.frameworkSlug === slug);
    const fl = links.filter((l) => l.frameworkSlug === slug);
    const byCode = new Map(fs.map((s) => [s.requirementCode, s]));
    const headings = headingCodes(framework);
    let csv = csvLine(["code", "title", "heading", "status", "owner", "due_on", "how_met_or_why_not_applicable", "organisation_interpretation", "evidence", "edition_change"]);
    for (const r of framework.requirements) {
      const s = byCode.get(r.code);
      csv += csvLine([
        r.code,
        r.title,
        headings.has(r.code) ? "yes" : "",
        headings.has(r.code) ? "" : (s?.status ?? "not_started"),
        who(s?.ownerUserId),
        iso(s?.dueOn ?? null),
        s?.notes ?? "",
        s?.interpretation ?? "",
        fl.filter((l) => l.requirementCode === r.code).map((l) => `${l.label}${l.url ? ` <${l.url}>` : ""}`).join("; "),
        r.editionChange ? `${r.editionChange.kind}: ${r.editionChange.note}` : "",
      ]);
    }
    add(`requirements/${slug}.csv`, csv);
    const soa = statementOfApplicability(framework, fs, fl);
    if (soa.length) {
      let soaCsv = csvLine(["control", "title", "applicable", "justification", "implementation_status", "evidence"]);
      for (const row of soa) soaCsv += csvLine([row.code, row.title, row.applicable ? "yes" : "no", row.justification, row.status, row.evidence]);
      add(`statement-of-applicability-${slug}.csv`, soaCsv);
    }
    frameworkLines.push(
      `  ${framework.shortName} (${framework.edition}): ${adoption.status}${adoption.certificateNumber ? `, certificate ${adoption.certificateNumber}` : ""}${adoption.certifiedUntil ? ` valid until ${iso(adoption.certifiedUntil)}` : ""}${adoption.scope ? `\n    Scope: ${adoption.scope.replace(/\s+/g, " ")}` : ""}`,
    );
  }

  // Registers, restricted to rows in scope.
  const registerLines: string[] = [];
  for (const key of REGISTER_KEYS) {
    const config = REGISTERS[key];
    const rows = (await delegate(key).findMany({ where: { organizationId: opts.orgId }, orderBy: { createdAt: "asc" }, take: 10_000 })).filter((r) => rowInScope(r, opts.frameworks));
    const fields = config.fields.map((f) => f.name);
    const extra = ["version", "approvedByUserId", "approvedOn"].filter((k) => rows.some((r) => k in r) && !fields.includes(k));
    let csv = csvLine(["id", ...fields, ...extra, "created_at", "updated_at"]);
    for (const r of rows) {
      csv += csvLine([
        r.id,
        ...[...fields, ...extra].map((f) => {
          const def = config.fields.find((x) => x.name === f);
          const v = r[f];
          if (def?.type === "member" || def?.type === "person" || f === "approvedByUserId") return who(v);
          if (def?.type === "checklist") return (v as Array<{ item: string; result: string; note?: string }>).map((x) => `${x.item}: ${x.result}${x.note ? ` (${x.note})` : ""}`).join("; ");
          return iso(v);
        }),
        iso(r.createdAt),
        iso(r.updatedAt),
      ]);
    }
    add(`registers/${key}.csv`, csv);
    registerLines.push(`  registers/${key}.csv${" ".repeat(Math.max(1, 34 - key.length))}${rows.length} ${config.label.toLowerCase()}`);
  }

  // Training matrix.
  const [competences, records] = await Promise.all([
    prisma.msCompetence.findMany({ where: { organizationId: opts.orgId }, select: { id: true, title: true, validityMonths: true }, orderBy: { title: "asc" } }),
    prisma.msTrainingRecord.findMany({ where: { organizationId: opts.orgId }, select: { id: true, competenceId: true, personUserId: true, personName: true, employer: true, completedOn: true, expiresOn: true } }),
  ]);
  const { rows: matrix } = trainingMatrix(competences, records, new Date());
  let matrixCsv = csvLine(["person", "employer", ...competences.map((c) => c.title)]);
  for (const r of matrix) matrixCsv += csvLine([r.name, r.employer ?? "", ...competences.map((c) => (r.cells[c.id] ? `${r.cells[c.id].state}${r.cells[c.id].expiresOn ? ` ${r.cells[c.id].expiresOn}` : ""}` : ""))]);
  add("training-matrix.csv", matrixCsv);

  // Evidence files.
  const fileIds = [...(await packEvidenceFileIds(opts.orgId, opts.frameworks))];
  const files = fileIds.length
    ? await prisma.evidenceFile.findMany({
        where: { organizationId: opts.orgId, id: { in: fileIds } },
        select: { id: true, filename: true, mimeType: true, byteSize: true, checksum: true, storageKey: true, createdAt: true },
      })
    : [];
  let evidenceCsv = csvLine(["evidence_id", "filename", "mime_type", "bytes", "sha256", "uploaded_at", "in_pack_as"]);
  let bytes = 0;
  let included = 0;
  let skipped = 0;
  for (const file of files) {
    let as = "";
    if (bytes + file.byteSize <= MAX_PACK_EVIDENCE_BYTES && file.storageKey && file.storageKey !== "pending") {
      try {
        const buf = await getObject(file.storageKey);
        as = `evidence/${file.id}-${zipSafeName(file.filename)}`;
        add(as, buf, file.checksum || undefined);
        bytes += buf.length;
        included++;
      } catch {
        skipped++;
        as = "not included: could not be read from storage";
      }
    } else {
      skipped++;
      as = "not included: pack size limit reached";
    }
    evidenceCsv += csvLine([file.id, file.filename, file.mimeType, file.byteSize, file.checksum, file.createdAt, as]);
  }
  add("evidence-index.csv", evidenceCsv);

  const readme = [
    `Certification pack: ${org?.name ?? "Organisation"}`,
    `Generated ${new Date().toISOString()} for ${opts.generatedFor} from MetricOra.`,
    ``,
    `Frameworks:`,
    ...frameworkLines,
    ``,
    `Requirement statuses, notes and interpretations are the organisation's own. MetricOra's guidance is a summary, not the standard's text; assess against your licensed copy.`,
    ``,
    `Files:`,
    `  requirements/<framework>.csv       status, owner, how each requirement is met, evidence`,
    `  statement-of-applicability-*.csv   Annex A controls, applicability and justification (where the standard has Annex A)`,
    ...registerLines,
    `  training-matrix.csv                latest training record per person and competence`,
    `  evidence-index.csv                 every file referenced, with its SHA-256`,
    `  evidence/                          ${included} files included${skipped ? `, ${skipped} listed but not included` : ""}`,
    `  manifest.sha256                    SHA-256 of every file above`,
    ``,
  ].join("\n");
  add("README.txt", readme);
  archive.append(manifest.map((m) => `${m.sha256}  ${m.name}`).join("\n") + "\n", { name: "manifest.sha256" });
  return { files: manifest.length + 1, evidenceIncluded: included, evidenceSkipped: skipped };
}

/** The pack as a streamed ZIP response. */
export async function certificationPackResponse(opts: { orgId: string; frameworks: string[]; generatedFor: string }): Promise<Response> {
  const [{ PassThrough, Readable }, { ZipArchive }, Sentry] = await Promise.all([import("node:stream"), import("archiver"), import("@sentry/nextjs")]);
  const archive = new ZipArchive({ zlib: { level: 6 } });
  const out = new PassThrough();
  archive.on("error", (err: Error) => {
    Sentry.captureException(err);
    out.destroy(err);
  });
  archive.pipe(out);
  void writeCertificationPack(archive, opts)
    .then(() => archive.finalize())
    .catch((err) => {
      Sentry.captureException(err);
      archive.abort();
      out.destroy(err instanceof Error ? err : new Error(String(err)));
    });
  const stamp = new Date().toISOString().slice(0, 10);
  return new Response(Readable.toWeb(out) as ReadableStream, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="certification-pack-${stamp}.zip"`,
      "Cache-Control": "no-store",
    },
  });
}
