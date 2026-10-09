import { prisma } from "@/lib/db";
import { dispatchNotification } from "@/lib/jobs/dispatch";
import { getLogger } from "@/lib/observability";
import { LINK_ISSUERS } from "@/lib/evidence/submission-link";
import { kindLabel, reminderStage } from "./documents";

// Weekly (migration 20261008000088): editors are told about accepted licences, permits and exemptions that
// end within 30 days or lapsed in the last 30. One notification per person, document and stage (30, 7,
// expired); the notification row is the record that it was sent, so a repeated run sends nothing twice.

const logger = getLogger("waste.reminders");

export async function processWasteDocumentReminders(now = new Date()): Promise<number> {
  const horizon = new Date(now.getTime() + 31 * 86_400_000);
  const floor = new Date(now.getTime() - 31 * 86_400_000);
  const docs = await prisma.wasteDocument.findMany({
    where: { status: "accepted", kind: { not: "transfer_note" }, validUntil: { gte: floor, lte: horizon } },
    select: { id: true, organizationId: true, kind: true, title: true, issuer: true, validUntil: true },
    take: 5000,
  });
  let sent = 0;
  const byOrg = new Map<string, typeof docs>();
  for (const d of docs) byOrg.set(d.organizationId, [...(byOrg.get(d.organizationId) ?? []), d]);

  for (const [orgId, list] of byOrg) {
    try {
      const people = await prisma.organizationMembership.findMany({ where: { organizationId: orgId, role: { in: LINK_ISSUERS }, terminatedAt: null }, select: { userId: true } });
      for (const d of list) {
        const stage = reminderStage(d.kind, d.validUntil, now);
        if (!stage) continue;
        const resourceId = `${d.id}:${stage}`;
        for (const { userId } of people) {
          const already = await prisma.notification.findFirst({ where: { organizationId: orgId, userId, type: "waste_document_expiry", resourceId }, select: { id: true } });
          if (already) continue;
          await dispatchNotification({
            type: "waste_document_expiry",
            recipientUserId: userId,
            orgId,
            resourceId,
            metadata: { stage: stage === "expired" ? "expired" : "soon", title: `${kindLabel(d.kind)}: ${d.issuer ?? d.title}`, validUntil: d.validUntil!.toISOString().slice(0, 10) },
          });
          sent++;
        }
      }
    } catch (err) {
      logger.error("Waste document reminder failed for an organisation", { orgId, error: err instanceof Error ? err.message : String(err) });
    }
  }
  return sent;
}
