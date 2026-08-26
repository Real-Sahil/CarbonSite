import { Prisma } from "@prisma/client";
import { createHash } from "crypto";
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
  | "report.verification_accessed"
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
  | "snapshot.assured"
  | "snapshot.assurance_retracted"
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
  | "dsar.export_completed"
  | "dsar.erasure_completed"
  | "dsar.erasure_rejected"
  | "dsar.sla_approaching"
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
  | "supplier_data_request.submitted"
  | "security.alert_repeated_failed_logins"
  | "security.alert_privilege_escalation"
  | "security.alert_mass_export"
  | "security.alert_bulk_data_mutation"
  | "security.alert_bulk_submission_review"
  | "security.alert_suspicious_location_jump"
  | "monitoring.health_check_failed"
  | "monitoring.health_check_error";

export async function writeAuditLog(params: {
  organizationId: string;
  actorUserId?: string | null;
  action: AuditAction;
  resourceType: string;
  resourceId: string;
  metadata?: Prisma.InputJsonObject;
  ipAddress?: string | null;
  userAgent?: string | null;
}) {
  const metadata = params.metadata ?? Prisma.JsonNull;
  const { ipAddress, userAgent } =
    params.ipAddress !== undefined || params.userAgent !== undefined
      ? { ipAddress: params.ipAddress ?? null, userAgent: params.userAgent ?? null }
      : await readAmbientRequestContext();

  await prisma.$transaction(async (tx) => {
    // Serialize hash-chain writes per organization so two concurrent audit
    // events can't both read the same "previous" row and fork the chain.
    // hashtext() bucket collisions across orgs just serialize a bit more —
    // never incorrect, only occasionally more conservative than necessary.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${params.organizationId}))`;

    const previous = await tx.auditLog.findFirst({
      where: { organizationId: params.organizationId },
      orderBy: { chainSeq: "desc" },
      select: { hash: true },
    });
    const previousHash = previous?.hash ?? null;
    const createdAt = new Date();

    const hash = createHash("sha256")
      .update(
        [
          previousHash ?? "",
          params.organizationId,
          params.actorUserId ?? "",
          params.action,
          params.resourceType,
          params.resourceId,
          JSON.stringify(params.metadata ?? {}),
          createdAt.toISOString(),
        ].join("|"),
      )
      .digest("hex");

    await tx.auditLog.create({
      data: {
        organizationId: params.organizationId,
        actorUserId: params.actorUserId ?? null,
        action: params.action,
        resourceType: params.resourceType,
        resourceId: params.resourceId,
        metadata,
        ipAddress,
        userAgent,
        previousHash,
        hash,
        createdAt,
      },
    });
  });
}

// Reads the client IP / user agent middleware.ts already resolved onto the
// current request (x-client-ip is middleware-set, not attacker-suppliable
// the way a bare X-Forwarded-For read here would be). Lets every route
// handler call writeAuditLog() without threading IP/UA through by hand.
// Returns nulls outside a request scope (e.g. pg-boss workers), which is
// the correct outcome there — those call sites should pass params explicitly
// if they have a real actor IP to record (see workers/*.ts for the pattern).
async function readAmbientRequestContext(): Promise<{
  ipAddress: string | null;
  userAgent: string | null;
}> {
  try {
    const { headers } = await import("next/headers");
    const h = await headers();
    return {
      ipAddress: h.get("x-client-ip"),
      userAgent: h.get("user-agent"),
    };
  } catch {
    return { ipAddress: null, userAgent: null };
  }
}

// Verifies the hash chain for an organization is intact — no row was
// altered or deleted out of sequence. Used by admin/audit tooling, not on
// the write path (recomputing every row's hash on every write would be
// O(n) per write). Returns the index of the first broken link, or null if
// the chain is fully intact.
export async function verifyAuditChain(organizationId: string): Promise<number | null> {
  const rows = await prisma.auditLog.findMany({
    where: { organizationId },
    orderBy: { chainSeq: "asc" },
    select: {
      actorUserId: true,
      action: true,
      resourceType: true,
      resourceId: true,
      metadata: true,
      createdAt: true,
      previousHash: true,
      hash: true,
    },
  });

  let expectedPreviousHash: string | null = null;
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]!;
    // Rows written before this migration have no hash — they predate the
    // chain and aren't verifiable, but aren't evidence of tampering either.
    if (row.hash === null) continue;
    if (row.previousHash !== expectedPreviousHash) return i;
    const recomputed: string = createHash("sha256")
      .update(
        [
          row.previousHash ?? "",
          organizationId,
          row.actorUserId ?? "",
          row.action,
          row.resourceType,
          row.resourceId,
          JSON.stringify(row.metadata ?? {}),
          row.createdAt.toISOString(),
        ].join("|"),
      )
      .digest("hex");
    if (recomputed !== row.hash) return i;
    expectedPreviousHash = row.hash;
  }
  return null;
}
