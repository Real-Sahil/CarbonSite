/**
 * Turns an uploaded attendance export into commuting records (see
 * attendance.ts for the method). The file is read in memory and never
 * stored; each month's aggregate by postcode district is kept as the
 * records' evidence. Records are created in review, so nothing reaches the
 * inventory until a reviewer approves it.
 */
import * as XLSX from "xlsx";
import { prisma } from "@/lib/db";
import { writeAuditLog } from "@/lib/db/audit";
import { storeEvidenceFile } from "@/lib/evidence/store";
import { getDistrictRoadKm } from "@/lib/geo/route-distance";
import {
  AttendanceError,
  LODGING_KM,
  RECORD_MODES,
  count,
  attendanceEvidenceCsv,
  commuteTotals,
  groupAttendance,
  kmByMode,
  modeSplit,
  parseAttendance,
  type MonthAttendance,
  type ParsedAttendance,
  type SurveyAnswer,
  type SurveyMode,
  type Workforce,
} from "./attendance";

export function readAttendanceFile(buffer: Buffer): ParsedAttendance {
  let rows: Record<string, unknown>[];
  try {
    // raw: CSV text stays text, so UK day-first dates are read by
    // attendanceDate() rather than guessed as US month-first; Excel date
    // cells still arrive as dates.
    const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true, raw: true });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    rows = sheet ? XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: null, raw: true }) : [];
  } catch {
    throw new AttendanceError("UNREADABLE", "The file could not be read. Upload a CSV or Excel export.");
  }
  return parseAttendance(rows);
}

export async function siteSurveyAnswers(orgId: string, siteId: string): Promise<SurveyAnswer[]> {
  const rows = await prisma.commuteSurveyResponse.findMany({
    where: { organizationId: orgId, survey: { organizationId: orgId, siteId } },
    select: { mode: true, occupancy: true, workforce: true },
  });
  return rows.map((r) => ({ mode: r.mode as SurveyMode, occupancy: r.occupancy, workforce: r.workforce as Workforce }));
}

const monthLabel = (month: string) =>
  new Date(`${month}-01T00:00:00Z`).toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });

export type ImportResult = {
  imports: { month: string; importId: string; records: number; ownKm: number; subcontractorKm: number }[];
};

export async function importAttendance(args: {
  orgId: string;
  userId: string;
  siteId: string;
  parsed: ParsedAttendance;
  ownEmployers: string[];
}): Promise<ImportResult> {
  const { orgId, userId, siteId, parsed } = args;
  const site = await prisma.site.findFirst({
    where: { id: siteId, organizationId: orgId },
    select: { id: true, name: true, postcode: true, project: { select: { contractId: true } } },
  });
  if (!site) throw new AttendanceError("NOT_FOUND", "Site not found.");
  if (!site.postcode) throw new AttendanceError("NO_SITE_POSTCODE", `Add a postcode to ${site.name} first: distances are measured to it.`);

  const months = groupAttendance(parsed.rows, args.ownEmployers);
  const category = await prisma.emissionCategory.findFirst({ where: { code: "s3-commuting" }, select: { id: true } });
  if (!category) throw new AttendanceError("NO_CATEGORY", "The employee commuting category is missing.");

  // Every month must land in an open reporting period and not be imported yet.
  const periods = new Map<string, string>();
  for (const m of months) {
    const at = new Date(`${m.lastDate}T00:00:00Z`);
    const period = await prisma.reportingPeriod.findFirst({
      where: { organizationId: orgId, startDate: { lte: at }, endDate: { gte: at } },
      orderBy: { startDate: "desc" },
      select: { id: true, status: true, label: true },
    });
    if (!period) throw new AttendanceError("NO_PERIOD", `No reporting period covers ${monthLabel(m.month)}. Add one in Settings, then import again.`);
    if (period.status === "locked") throw new AttendanceError("LOCKED", `${period.label} is locked, so ${monthLabel(m.month)} cannot be imported.`);
    periods.set(m.month, period.id);
  }
  const existing = await prisma.commuteImport.findMany({
    where: { organizationId: orgId, siteId, month: { in: months.map((m) => new Date(`${m.month}-01T00:00:00Z`)) } },
    select: { month: true },
  });
  if (existing.length > 0) {
    const names = existing.map((e) => monthLabel(e.month.toISOString().slice(0, 7))).join(", ");
    throw new AttendanceError("ALREADY_IMPORTED", `${site.name} already has commuting for ${names}. Delete that import first to replace it.`);
  }

  // One road distance per district, shared by every month.
  const districts = [...new Set(months.flatMap((m) => [...m.own, ...m.subcontractor].map((d) => d.district)).filter((d): d is string => !!d))];
  const oneWayKm = new Map<string, number | null>();
  const methods = new Map<string, string>();
  for (const district of districts) {
    const d = await getDistrictRoadKm({ organizationId: orgId, district, sitePostcode: site.postcode });
    oneWayKm.set(district, d.km);
    methods.set(district, d.method);
  }

  const answers = await siteSurveyAnswers(orgId, siteId);
  const ownSplit = modeSplit(answers, "own");
  const result: ImportResult = { imports: [] };

  for (const m of months) {
    const own = commuteTotals(m.own, oneWayKm);
    const sub = commuteTotals(m.subcontractor, oneWayKm);
    const evidence = await storeEvidenceFile(orgId, userId, {
      name: `commuting-${m.month}-${site.name.replace(/[^A-Za-z0-9]+/g, "-").slice(0, 40)}.csv`,
      type: "text/csv",
      buffer: Buffer.from(attendanceEvidenceCsv(m, oneWayKm, methods)),
    });
    const notes = assumptionNotes(m, own, ownSplit.source, ownSplit.vans);
    const monthStart = new Date(`${m.month}-01T00:00:00Z`);
    const firstDate = new Date(`${m.firstDate}T00:00:00Z`);
    const lastDate = new Date(`${m.lastDate}T00:00:00Z`);

    const recordIds = await prisma.$transaction(async (tx) => {
      const ids: string[] = [];
      for (const { mode, km } of kmByMode(own.personKm, ownSplit)) {
        const record = await tx.activityRecord.create({
          data: {
            organizationId: orgId,
            reportingPeriodId: periods.get(m.month)!,
            emissionCategoryId: category.id,
            siteId: site.id,
            contractId: site.project.contractId,
            amount: km,
            unit: "km",
            activityDate: lastDate,
            startDate: firstDate,
            endDate: lastDate,
            transportMode: RECORD_MODES[mode].transportMode,
            country: "GB",
            sourceDescription: `Commuting to ${site.name}, ${monthLabel(m.month)}: ${RECORD_MODES[mode].label}`,
            assumptionNotes: notes,
            dataOrigin: "calculated",
            reviewStatus: "in_review",
            evidenceStatus: "complete",
            createdByUserId: userId,
          },
          select: { id: true },
        });
        await tx.activityRecordEvidence.create({
          data: { organizationId: orgId, activityRecordId: record.id, evidenceFileId: evidence.id },
        });
        ids.push(record.id);
      }
      await tx.commuteImport.create({
        data: {
          organizationId: orgId,
          siteId: site.id,
          month: monthStart,
          evidenceFileId: evidence.id,
          recordIds: ids,
          createdByUserId: userId,
          summary: {
            own,
            subcontractor: sub,
            split: { source: ownSplit.source, weights: ownSplit.weights },
            ownEmployers: args.ownEmployers,
          },
        },
      });
      return ids;
    });

    for (const id of recordIds) {
      await writeAuditLog({
        organizationId: orgId,
        actorUserId: userId,
        action: "record.created",
        resourceType: "activity_record",
        resourceId: id,
        metadata: { source: "commuting_attendance", siteId: site.id, month: m.month },
      });
    }
    const imp = await prisma.commuteImport.findFirst({ where: { organizationId: orgId, siteId, month: monthStart }, select: { id: true } });
    await writeAuditLog({
      organizationId: orgId,
      actorUserId: userId,
      action: "commuting.imported",
      resourceType: "commute_import",
      resourceId: imp!.id,
      metadata: { siteId: site.id, month: m.month, records: recordIds.length, ownDays: own.days, subcontractorDays: sub.days },
    });
    result.imports.push({
      month: m.month,
      importId: imp!.id,
      records: recordIds.length,
      ownKm: Math.round(own.personKm),
      subcontractorKm: Math.round(sub.personKm),
    });
  }
  return result;
}

function assumptionNotes(m: MonthAttendance, own: ReturnType<typeof commuteTotals>, splitSource: string, vans: boolean): string {
  const parts = [
    `Distance-based (GHG Protocol Scope 3 Category 7) from site attendance: ${count(own.days, "own-staff day")} on site by ${count(own.people, "person", "people")}, ${m.firstDate} to ${m.lastDate}.`,
    "Return road distance from each person's home postcode district centre to the site.",
    `Mode split: ${splitSource}.`,
  ];
  if (vans) parts.push("Vans are priced with the average car factor (the library has no van commuting factor), which understates them.");
  if (own.averagedDays > 0) parts.push(`${count(own.averagedDays, "day")} with no usable home postcode counted at the average distance.`);
  if (own.lodgingDays > 0) parts.push(`${count(own.lodgingDays, "day")} over ${LODGING_KM} km one way left out as likely lodging near site; record those stays under business travel.`);
  parts.push("Subcontractor travel is not included (their employer's emissions; Category 1).");
  return parts.join(" ");
}

/** Removes an import and its records while none is approved or calculated. */
export async function deleteCommuteImport(orgId: string, userId: string, importId: string): Promise<void> {
  const imp = await prisma.commuteImport.findFirst({ where: { id: importId, organizationId: orgId } });
  if (!imp) throw new AttendanceError("NOT_FOUND", "Import not found.");
  const records = await prisma.activityRecord.findMany({
    where: { organizationId: orgId, id: { in: imp.recordIds } },
    select: { id: true, reviewStatus: true, _count: { select: { calculations: true } } },
  });
  if (records.some((r) => r.reviewStatus === "approved" || r._count.calculations > 0)) {
    throw new AttendanceError("IN_USE", "Some of these records are approved or calculated. Reject them in review instead.");
  }
  await prisma.$transaction([
    prisma.activityRecord.deleteMany({ where: { organizationId: orgId, id: { in: records.map((r) => r.id) } } }),
    prisma.commuteImport.delete({ where: { id: imp.id } }),
  ]);
  for (const r of records) {
    await writeAuditLog({ organizationId: orgId, actorUserId: userId, action: "record.deleted", resourceType: "activity_record", resourceId: r.id, metadata: { source: "commuting_attendance" } });
  }
  await writeAuditLog({ organizationId: orgId, actorUserId: userId, action: "commuting.import_deleted", resourceType: "commute_import", resourceId: imp.id, metadata: { month: imp.month.toISOString().slice(0, 7) } });
}
