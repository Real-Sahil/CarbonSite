// DSAR erasure worker (UK GDPR Art. 17) — tombstones the subject's User
// row and applies each PII-registry entry's erasure strategy. See
// lib/compliance/pii-registry.ts for the design rationale: most tables
// only reference a person via a required FK to User, so tombstoning User
// severs the identity link everywhere at once; only tables with PII
// genuinely independent of that FK (free text, a non-platform-user's
// contact email) need their own per-model "redact" logic.

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { writeAuditLog } from "@/lib/db/audit";
import { PII_REGISTRY, delegateNameFor, type PiiSubject } from "@/lib/compliance/pii-registry";

type WriteDelegate = {
  deleteMany: (args: { where: Record<string, unknown> }) => Promise<unknown>;
};

function getDelegate(tx: Prisma.TransactionClient, modelName: string): WriteDelegate {
  return (tx as unknown as Record<string, WriteDelegate>)[delegateNameFor(modelName)];
}

export async function processDsarErasure(dsarRequestId: string): Promise<void> {
  const request = await prisma.dsarRequest.findUnique({ where: { id: dsarRequestId } });
  if (!request) throw new Error(`DSAR request not found: ${dsarRequestId}`);
  if (request.type !== "erasure") {
    throw new Error(`DSAR request ${dsarRequestId} is type "${request.type}", not "erasure"`);
  }

  await prisma.dsarRequest.update({
    where: { id: dsarRequestId },
    data: { status: "processing" },
  });

  const user = await prisma.user.findUnique({
    where: { id: request.userId },
    select: { id: true, email: true },
  });
  if (!user) throw new Error(`Subject user not found: ${request.userId}`);
  const subject: PiiSubject = { userId: user.id, email: user.email };

  // Legal-basis pre-check: don't silently strip the only admin from an org
  // as a side effect of an erasure request. The response to the subject is
  // still required within the DSAR SLA either way — "rejected" with a
  // reason is a valid, timely answer under Art. 17(3), not a stall.
  const adminMemberships = await prisma.organizationMembership.findMany({
    where: { userId: user.id, role: "admin" },
    select: { organizationId: true },
  });
  const soleAdminOrgs: string[] = [];
  for (const { organizationId } of adminMemberships) {
    const otherAdminCount = await prisma.organizationMembership.count({
      where: { organizationId, role: "admin", userId: { not: user.id } },
    });
    if (otherAdminCount === 0) soleAdminOrgs.push(organizationId);
  }
  if (soleAdminOrgs.length > 0) {
    await prisma.dsarRequest.update({
      where: { id: dsarRequestId },
      data: {
        status: "rejected",
        completedAt: new Date(),
        notes:
          `Cannot erase: subject is the sole admin of ${soleAdminOrgs.length} organization(s) ` +
          `(${soleAdminOrgs.join(", ")}). Transfer admin ownership first, then resubmit.`,
      },
    });
    for (const organizationId of soleAdminOrgs) {
      await writeAuditLog({
        organizationId,
        actorUserId: request.requestedByUserId,
        action: "dsar.erasure_rejected",
        resourceType: "dsar_request",
        resourceId: dsarRequestId,
        metadata: { subjectUserId: user.id, reason: "sole_admin" },
      });
    }
    return;
  }

  try {
    await prisma.$transaction(async (tx) => {
      // Tombstone the User row — this is what severs the identity link for
      // every other table that merely references createdByUserId/
      // uploadedByUserId/etc. rather than requiring per-table field nulling
      // (most of those columns are NOT NULL and can't just be set to null).
      await tx.user.update({
        where: { id: user.id },
        data: {
          email: `erased-${user.id}@erased.invalid`,
          name: null,
          image: null,
          emailVerified: false,
          emailVerifiedAt: null,
        },
      });

      for (const entry of PII_REGISTRY) {
        if (entry.model === "User") continue; // handled above
        const delegate = getDelegate(tx, entry.model);
        if (entry.erasureStrategy === "delete") {
          await delegate.deleteMany({ where: entry.where(subject) });
        } else if (entry.erasureStrategy === "redact") {
          if (!entry.redact) throw new Error(`${entry.model} is "redact" with no redact()`);
          await entry.redact(tx, subject);
        }
        // "retain" and any other strategy: no row-level action.
      }
    });

    await prisma.dsarRequest.update({
      where: { id: dsarRequestId },
      data: { status: "completed", completedAt: new Date() },
    });

    // Same reasoning as workers/dsar-export.ts: AuditLog.organizationId is
    // a required FK, so record into every org the (now-tombstoned) subject
    // still has a membership row in.
    const memberships = await prisma.organizationMembership.findMany({
      where: { userId: user.id },
      select: { organizationId: true },
    });
    for (const { organizationId } of memberships) {
      await writeAuditLog({
        organizationId,
        actorUserId: request.requestedByUserId,
        action: "dsar.erasure_completed",
        resourceType: "dsar_request",
        resourceId: dsarRequestId,
        metadata: { subjectUserId: user.id },
      });
    }
  } catch (err) {
    await prisma.dsarRequest.update({
      where: { id: dsarRequestId },
      data: { status: "failed" },
    });
    throw err;
  }
}
