import { Prisma } from "@prisma/client";
import { prisma } from "./index";

type AuditAction =
  | "auth.sign_in"
  | "auth.sign_out"
  | "org.member.invite"
  | "org.member.role_change"
  | "org.member.remove"
  | "import.created"
  | "import.committed"
  | "import.evidence_attached"
  | "import.failed"
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
