export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireOrgMember } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/db/audit";
import { rateLimitRequest } from "@/lib/security/rate-limit-async";
import { rateLimitKey } from "@/lib/security/rate-limit";
import { apiError, handleRouteError } from "@/lib/validation/api";
import { LINK_ISSUERS } from "@/lib/evidence/submission-link";
import { sendEmail } from "@/lib/notifications/email";
import { carrierAskEmail, missingFields } from "@/lib/waste/carrier-ask";

const body = z.object({
  to: z.string().trim().email().max(200),
  note: z.string().trim().max(500).optional(),
}).strict();

// POST: a person asks the carrier for what its transfer note is missing. One email, sent now, from the
// organisation's name, with the sender's own address as the reply-to. The list of gaps comes from the stored
// reading, never from the request.
export async function POST(req: NextRequest, { params }: { params: Promise<{ orgId: string; id: string }> }) {
  try {
    const { orgId, id } = await params;
    const { session } = await requireOrgMember(orgId, ...LINK_ISSUERS);
    const limited = await rateLimitRequest(req, { key: rateLimitKey(orgId, "ask-carrier", session.user.id), limit: 20, windowMs: 60 * 60_000 });
    if (limited) return limited;
    const b = body.parse(await req.json());
    const doc = await prisma.wasteDocument.findFirst({ where: { id, organizationId: orgId } });
    if (!doc) return apiError("NOT_FOUND", "Document not found.", 404);
    if (doc.kind !== "transfer_note") return apiError("NOT_A_TRANSFER_NOTE", "Only a transfer note can be queried.", 422);
    if (doc.wasteRecordId) return apiError("ALREADY_RECORDED", "This note is already recorded.", 409);
    const extracted = (doc.extracted ?? {}) as Parameters<typeof missingFields>[0] & { carrier?: string; carrierAsked?: unknown };
    const missing = missingFields(extracted);
    if (missing.length === 0) return apiError("NOTHING_MISSING", "Nothing is missing from this note.", 422);

    const [org, sender] = await Promise.all([
      prisma.organization.findUnique({ where: { id: orgId }, select: { name: true } }),
      prisma.user.findUnique({ where: { id: session.user.id }, select: { name: true, email: true } }),
    ]);
    const senderName = sender?.name?.trim() || "Our team";
    const mail = carrierAskEmail({ orgName: org?.name ?? "our organisation", senderName, noteTitle: doc.title, missing, note: b.note });
    await sendEmail({ to: b.to, subject: mail.subject, text: mail.text, html: mail.html, ...(sender?.email && { replyTo: sender.email }) });

    // Keep when and what was asked, not the address: the record shows the request without holding a third party's contact.
    await prisma.wasteDocument.update({
      where: { id },
      data: { extracted: { ...extracted, carrierAsked: { at: new Date().toISOString(), missing } } },
    });
    await writeAuditLog({
      organizationId: orgId,
      actorUserId: session.user.id,
      action: "waste_document.carrier_asked",
      resourceType: "WasteDocument",
      resourceId: id,
      metadata: { missing, recipientDomain: b.to.split("@")[1] ?? null },
    });
    return NextResponse.json({ ok: true, missing }, { status: 201 });
  } catch (err) {
    return handleRouteError(err);
  }
}
