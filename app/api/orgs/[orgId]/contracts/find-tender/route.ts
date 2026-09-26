export const dynamic = "force-dynamic";

/**
 * POST /api/orgs/{orgId}/contracts/find-tender
 * { notice: "091200-2026" | notice URL }            → preview: draft + warnings
 * { notice, confirm: true, draft: {...edited...} }  → creates the contract
 * The notice is read from Find a Tender again on confirm; the edited draft
 * fields are validated like any contract, and a notice imports once per org.
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireOrgMember, ROLE_GROUPS } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/db/audit";
import { apiError, handleRouteError } from "@/lib/validation/api";
import { rateLimitRequest } from "@/lib/security/rate-limit-async";
import { rateLimitKey } from "@/lib/security/rate-limit";
import { FtsRateLimited, fetchNotice, noticeUrl, parseNoticeId, summariseRelease } from "@/lib/tenders/fts";
import { contractDraft, draftWarnings } from "@/lib/tenders/import";

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional();
const bodySchema = z.object({
  notice: z.string().min(1).max(300),
  confirm: z.boolean().optional(),
  draft: z
    .object({
      name: z.string().trim().min(1).max(200),
      clientName: z.string().trim().max(200).nullable().optional(),
      contractValue: z.number().min(0).max(1e13).nullable().optional(),
      currency: z.string().length(3).optional(),
      startDate: day,
      endDate: day,
    })
    .optional(),
});

export async function POST(req: NextRequest, { params }: { params: Promise<{ orgId: string }> }) {
  try {
    const { orgId } = await params;
    const { session } = await requireOrgMember(orgId, ...ROLE_GROUPS.contractManagers);
    const limited = await rateLimitRequest(req, { key: rateLimitKey(orgId, "fts-import", session.user.id), limit: 30, windowMs: 60_000 });
    if (limited) return limited;

    const parsed = bodySchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return apiError("VALIDATION_ERROR", "Invalid request.", 400, parsed.error.flatten());
    const noticeId = parseNoticeId(parsed.data.notice);
    if (!noticeId) return apiError("INVALID_NOTICE", "Enter a Find a Tender notice number such as 091200-2026, or the notice's web address.", 400);

    let release;
    try {
      release = await fetchNotice(noticeId);
    } catch (err) {
      if (err instanceof FtsRateLimited) return apiError("FTS_RATE_LIMITED", `Find a Tender is busy. Try again in ${Math.ceil(err.retryAfterSeconds / 60)} minute(s).`, 503);
      return apiError("FTS_UNAVAILABLE", "Find a Tender did not answer. Try again in a few minutes.", 502);
    }
    if (!release) return apiError("NOT_FOUND", `Find a Tender has no notice ${noticeId}.`, 404);

    const summary = summariseRelease(release);
    const org = await prisma.organization.findUnique({ where: { id: orgId }, select: { name: true } });
    const draft = contractDraft(summary);
    const existing = await prisma.contract.findFirst({ where: { organizationId: orgId, ftsNoticeId: noticeId }, select: { id: true, name: true } });

    if (!parsed.data.confirm) {
      return NextResponse.json({
        draft,
        warnings: draftWarnings(summary, org?.name ?? ""),
        stage: summary.stage,
        suppliers: summary.suppliers,
        noticeUrl: noticeUrl(noticeId),
        existingContract: existing,
      });
    }
    if (existing) return apiError("CONTRACT_EXISTS", `Notice ${noticeId} is already imported as "${existing.name}".`, 409);

    const edits: NonNullable<z.infer<typeof bodySchema>["draft"]> | Record<string, never> = parsed.data.draft ?? {};
    const start = edits.startDate !== undefined ? edits.startDate : draft.startDate;
    const end = edits.endDate !== undefined ? edits.endDate : draft.endDate;
    if (start && end && end < start) return apiError("VALIDATION_ERROR", "End date cannot fall before the start date.", 400);

    const contract = await prisma.contract.create({
      data: {
        organizationId: orgId,
        name: edits.name ?? draft.name,
        clientName: edits.clientName !== undefined ? edits.clientName : draft.clientName,
        contractReference: draft.contractReference,
        tenderReference: draft.tenderReference,
        procuringAuthority: draft.procuringAuthority,
        contractValue: edits.contractValue !== undefined ? edits.contractValue : draft.contractValue,
        currency: (edits.currency ?? draft.currency).toUpperCase(),
        startDate: start ? new Date(`${start}T00:00:00Z`) : null,
        endDate: end ? new Date(`${end}T00:00:00Z`) : null,
        ftsNoticeId: noticeId,
        notes: draft.notes,
        createdByUserId: session.user.id,
      },
    });
    await writeAuditLog({
      organizationId: orgId,
      actorUserId: session.user.id,
      action: "contract.created",
      resourceType: "Contract",
      resourceId: contract.id,
      metadata: { name: contract.name, source: "find_a_tender", noticeId },
    });
    return NextResponse.json({ contract }, { status: 201 });
  } catch (err) {
    return handleRouteError(err);
  }
}
