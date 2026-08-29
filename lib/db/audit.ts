import { Prisma } from "@prisma/client";
import { prisma } from "./index";

type AuditAction =
  | "auth.sign_in"
  | "auth.sign_out"
  | "auth.mfa_enabled"
  | "auth.mfa_disabled"
  | "org.created"
  | "org.updated"
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
  | "evidence.downloaded"
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
  | "calculation.run_cancelled"
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
  | "field_submission.resubmitted"
  | "snapshot.approved"
  | "snapshot.changes_requested"
  | "field_worker.assignment_created"
  | "field_worker.assignment_deleted"
  | "field_worker.site_assigned"
  | "field_worker.site_unassigned"
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
  | "branding.logo_uploaded"
  | "social_value_record.created"
  | "social_value_record.deleted"
  | "social_value_target.upserted"
  | "audit.export_downloaded"
  | "audit.data_export_requested"
  | "webhook.created"
  | "webhook.deleted"
  | "field_submission.assigned"
  | "embodied_carbon.record_created"
  | "embodied_carbon.record_deleted"
  | "api_key.created"
  | "api_key.deleted"
  | "notification.sent"
  | "record.version_snapshot"
  | "supplier_invite.created"
  | "supplier_invite.revoked"
  | "supplier_invite.accepted"
  | "epd.submitted"
  | "integration.connected"
  | "integration.disconnected"
  | "supplier_data_request.sent"
  | "supplier_data_request.submitted";

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

export async function verifyAuditChain(recordId: string): Promise<boolean> {
  // Stub: verifyAuditChain not yet implemented
  return true;
}
