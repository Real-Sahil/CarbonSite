import { Prisma } from "@prisma/client";
import { prisma } from "./index";

type AuditAction =
  | "auth.sign_in"
  | "auth.sign_out"
  | "business_unit.created"
  | "business_unit.deleted"
  | "business_unit.updated"
  | "evidence.downloaded"
  | "evidence.uploaded"
  | "facility.created"
  | "facility.deleted"
  | "facility.updated"
  | "org.created"
  | "org.member.invite_accepted"
  | "org.member.invite"
  | "org.member.role_change"
  | "org.member.remove"
  | "reporting_period.created"
  | "reporting_period.updated"
  | "import.created"
  | "import.committed"
  | "import.evidence_attached"
  | "import.failed"
  | "record.created"
  | "record.updated"
  | "record.deleted"
  | "record.reviewed"
  | "factor.library_imported"
  | "calculation.run_failed"
  | "calculation.run_triggered"
  | "calculation.run_completed"
  | "comment.created"
  | "review_task.assigned"
  | "review_task.status_changed"
  | "snapshot.published"
  | "report.generation_triggered"
  | "report.failed"
  | "report.published"
  | "report.downloaded"
  | "target.created"
  | "initiative.created"
  | "field_submission.submitted"
  | "field_submission.reviewed";

export async function writeAuditLog(params: {
  organizationId: string;
  actorUserId?: string | null;
  action: AuditAction;
  resourceType: string;
  resourceId: string;
  metadata?: Prisma.InputJsonObject;
}) {
  await prisma.auditLog.create({
    data: {
      organizationId: params.organizationId,
      actorUserId: params.actorUserId ?? null,
      action: params.action,
      resourceType: params.resourceType,
      resourceId: params.resourceId,
      metadata: params.metadata ?? Prisma.JsonNull,
    },
  });
}
