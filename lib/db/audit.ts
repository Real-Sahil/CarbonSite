import { Prisma } from "@prisma/client";
import { prisma } from "./index";

type AuditAction =
  | "auth.sign_in"
  | "auth.sign_out"
  | "org.created"
  | "org.member.invite"
  | "org.member.invite_accepted"
  | "org.member.added"
  | "org.member.role_change"
  | "org.member.remove"
  | "business_unit.created"
  | "business_unit.updated"
  | "business_unit.deleted"
  | "facility.created"
  | "facility.updated"
  | "facility.deleted"
  | "reporting_period.created"
  | "reporting_period.updated"
  | "comment.created"
  | "evidence.uploaded"
  | "import.created"
  | "import.committed"
  | "import.failed"
  | "import.error_export_downloaded"
  | "record.created"
  | "record.updated"
  | "record.deleted"
  | "record.reviewed"
  | "factor.library_imported"
  | "calculation.run_triggered"
  | "calculation.run_completed"
  | "snapshot.published"
  | "report.generation_triggered"
  | "report.published"
  | "report.downloaded"
  | "target.created"
  | "target.deleted"
  | "initiative.created"
  | "initiative.deleted"
  | "field_submission.submitted"
  | "field_submission.reviewed"
  | "field_submission.approved"
  | "field_submission.rejected"
  | "field_submission.needs_info"
  | "snapshot.approved"
  | "snapshot.changes_requested"
  | "field_worker.assignment_created"
  | "field_worker.assignment_deleted"
  | "contract.created"
  | "contract.updated"
  | "contract.deleted"
  | "project.created"
  | "project.updated"
  | "project.deleted"
  | "site.created"
  | "site.updated"
  | "site.deleted"
  | "branding.upserted"
  | "social_value_record.created"
  | "social_value_record.deleted"
  | "social_value_target.upserted";

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
