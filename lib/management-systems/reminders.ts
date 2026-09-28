import { prisma } from "@/lib/db";
import { dispatchNotification } from "@/lib/jobs/dispatch";
import { getLogger } from "@/lib/observability";
import { getFramework } from "./catalogue";
import { MS_EDITORS } from "./access";
import { REGISTERS, type RegisterKey } from "./registers/config";
import { delegate } from "./registers/server";

// Daily reminders on every date the management systems keep: policy and
// document reviews, risk reviews, audits, corrective action due dates,
// training expiries, equipment checks, supplier re-evaluations, objective
// dates, requirement due dates, certificate expiry and RIDDOR reports not yet
// made to HSE. Each date sends one "due soon" and one "overdue" reminder, to
// the row's owner or, when it has none, to the management system editors. MsReminderLog makes a repeated or
// late run send nothing twice.

const logger = getLogger("management-systems.reminders");

export const DUE_SOON_DAYS = 14;
export const CERTIFICATE_NOTICE_DAYS = 90;
/** Overdue items older than this are left alone rather than chased every day. */
const LOOKBACK_DAYS = 365;

export type Stage = "due_soon" | "overdue";

const DAY = 86_400_000;
const iso = (d: Date) => d.toISOString().slice(0, 10);

export function reminderStage(dueOn: Date, today: Date, noticeDays = DUE_SOON_DAYS): Stage | null {
  const days = Math.round((dueOn.getTime() - today.getTime()) / DAY);
  if (days < 0) return "overdue";
  return days <= noticeDays ? "due_soon" : null;
}

/**
 * RIDDOR 2013 report deadline for an incident marked reportable. An over-7-day
 * injury has 15 days from the incident; deaths, specified injuries, dangerous
 * occurrences and anything not clearly over-7-day get the shorter 10 days, so
 * an unclear case is never chased late. (Diseases are due without delay once
 * diagnosed; 10 days from the record is the reminder, not the legal limit.)
 */
export function riddorDeadline(incident: { occurredAt: Date; incidentType: string; lostTimeDays: number }): Date {
  const days = incident.incidentType === "lost_time_injury" && incident.lostTimeDays > 7 ? 15 : 10;
  const d = new Date(iso(incident.occurredAt) + "T00:00:00Z");
  return new Date(d.getTime() + days * DAY);
}

export type Due = {
  orgId: string;
  source: string;
  rowId: string;
  field: string;
  dueOn: Date;
  stage: Stage;
  label: string;
  title: string;
  ownerUserId: string | null;
  path: string;
};

/** Everything due soon or overdue today, before checking what was already sent. */
export async function collectDue(today: Date): Promise<Due[]> {
  const from = new Date(today.getTime() - LOOKBACK_DAYS * DAY);
  const to = new Date(today.getTime() + DUE_SOON_DAYS * DAY);
  const out: Due[] = [];

  for (const key of Object.keys(REGISTERS) as RegisterKey[]) {
    const config = REGISTERS[key];
    for (const r of config.reminders ?? []) {
      const rows = await delegate(key).findMany({
        where: {
          [r.field]: { gte: from, lte: to },
          ...(r.skipStatuses?.length && config.fields.some((f) => f.name === "status") ? { status: { notIn: r.skipStatuses } } : {}),
        },
        take: 5000,
      });
      for (const row of rows) {
        const dueOn = row[r.field] as Date;
        const stage = reminderStage(dueOn, today);
        if (!stage) continue;
        out.push({
          orgId: String(row.organizationId),
          source: key,
          rowId: row.id,
          field: r.field,
          dueOn,
          stage,
          label: r.label,
          title: String(row[config.titleField] ?? config.singular).slice(0, 120),
          ownerUserId: r.ownerField ? ((row[r.ownerField] as string | null) ?? null) : null,
          path: `management-systems/registers/${key}#row-${row.id}`,
        });
      }
    }
  }

  const statuses = await prisma.msRequirementStatus.findMany({
    where: { dueOn: { gte: from, lte: to }, status: { in: ["not_started", "in_progress"] } },
    select: { id: true, organizationId: true, frameworkSlug: true, requirementCode: true, ownerUserId: true, dueOn: true },
    take: 5000,
  });
  for (const s of statuses) {
    const stage = reminderStage(s.dueOn!, today);
    const framework = getFramework(s.frameworkSlug);
    if (!stage || !framework) continue;
    const req = framework.requirements.find((r) => r.code === s.requirementCode);
    out.push({
      orgId: s.organizationId,
      source: "requirement",
      rowId: s.id,
      field: "dueOn",
      dueOn: s.dueOn!,
      stage,
      label: `${framework.shortName} requirement`,
      title: `${s.requirementCode} ${req?.title ?? ""}`.trim(),
      ownerUserId: s.ownerUserId,
      path: `management-systems/${s.frameworkSlug}#req-${s.requirementCode.replace(/[^A-Za-z0-9]+/g, "-")}`,
    });
  }

  // RIDDOR reports not yet made. The longest deadline is 15 days, so only
  // incidents from the last 15 days plus the overdue lookback can be due.
  const riddor = await prisma.hsIncidentReport.findMany({
    where: { riddorReportable: true, riddorNotifiedAt: null, occurredAt: { gte: from, lte: today } },
    select: { id: true, organizationId: true, reference: true, title: true, incidentType: true, occurredAt: true, lostTimeDays: true, ownerUserId: true },
    take: 5000,
  });
  for (const i of riddor) {
    const dueOn = riddorDeadline(i);
    const stage = reminderStage(dueOn, today);
    if (!stage) continue;
    out.push({
      orgId: i.organizationId,
      source: "riddor",
      rowId: i.id,
      field: "riddorNotifiedAt",
      dueOn,
      stage,
      label: "RIDDOR report to HSE",
      title: `${i.reference}${i.title ? ` ${i.title}` : ""}`.slice(0, 120),
      ownerUserId: i.ownerUserId,
      path: `hs-incident-reports/${i.id}`,
    });
  }

  const certificates = await prisma.msFrameworkAdoption.findMany({
    where: { status: "certified", certifiedUntil: { gte: from, lte: new Date(today.getTime() + CERTIFICATE_NOTICE_DAYS * DAY) } },
    select: { id: true, organizationId: true, frameworkSlug: true, certifiedUntil: true },
  });
  for (const c of certificates) {
    const stage = reminderStage(c.certifiedUntil!, today, CERTIFICATE_NOTICE_DAYS);
    if (!stage) continue;
    out.push({
      orgId: c.organizationId,
      source: "certificate",
      rowId: c.id,
      field: "certifiedUntil",
      dueOn: c.certifiedUntil!,
      stage,
      label: "Certificate expiry",
      title: getFramework(c.frameworkSlug)?.shortName ?? c.frameworkSlug,
      ownerUserId: null,
      path: `management-systems/${c.frameworkSlug}`,
    });
  }
  return out;
}

/** Sends each due reminder once. Returns how many were sent. */
export async function processManagementSystemReminders(today = new Date(iso(new Date()) + "T00:00:00Z")): Promise<number> {
  const due = await collectDue(today);
  let sent = 0;
  const editorsByOrg = new Map<string, string[]>();

  for (const d of due) {
    const already = await prisma.msReminderLog.findUnique({
      where: { organizationId_source_rowId_field_dueOn_stage: { organizationId: d.orgId, source: d.source, rowId: d.rowId, field: d.field, dueOn: d.dueOn, stage: d.stage } },
      select: { id: true },
    });
    if (already) continue;

    let recipients: string[] = [];
    if (d.ownerUserId) {
      const owner = await prisma.organizationMembership.findFirst({
        where: { organizationId: d.orgId, userId: d.ownerUserId, terminatedAt: null },
        select: { userId: true },
      });
      if (owner) recipients = [owner.userId];
    }
    if (!recipients.length) {
      if (!editorsByOrg.has(d.orgId)) {
        const editors = await prisma.organizationMembership.findMany({
          where: { organizationId: d.orgId, role: { in: MS_EDITORS }, terminatedAt: null },
          select: { userId: true },
        });
        editorsByOrg.set(d.orgId, editors.map((e) => e.userId));
      }
      recipients = editorsByOrg.get(d.orgId)!;
    }

    // Log first: a crash after sending must not send the same reminder tomorrow.
    await prisma.msReminderLog.create({
      data: { organizationId: d.orgId, source: d.source, rowId: d.rowId, field: d.field, dueOn: d.dueOn, stage: d.stage },
    });
    for (const userId of recipients) {
      await dispatchNotification({
        type: "ms_reminder",
        recipientUserId: userId,
        orgId: d.orgId,
        resourceId: d.rowId,
        metadata: { stage: d.stage, label: d.label, title: d.title, dueOn: iso(d.dueOn), path: d.path, source: d.source },
      }).catch((err) => logger.error("Failed to dispatch management system reminder", { rowId: d.rowId, error: err instanceof Error ? err.message : String(err) }));
    }
    sent++;
  }
  return sent;
}
