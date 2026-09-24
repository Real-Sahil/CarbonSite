export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireOrgMember, ROLE_GROUPS } from "@/lib/auth/session";
import { handleRouteError } from "@/lib/validation/api";
import { z } from "zod";

const DEFAULT_SLA_HOURS = 48;

const querySchema = z.object({
  slaHours: z.coerce.number().int().min(1).max(720).default(DEFAULT_SLA_HOURS),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

/**
 * GET /api/orgs/[orgId]/field-submissions/sla-overdue
 * Returns submissions that have been pending review for longer than slaHours (default 48).
 * Used to surface SLA breaches in the reviewer dashboard.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ orgId: string }> }) {
  try {
    const { orgId } = await params;
    await requireOrgMember(orgId, ...ROLE_GROUPS.reviewersAndEditors);

    const query = querySchema.parse({
      slaHours: req.nextUrl.searchParams.get("slaHours") ?? DEFAULT_SLA_HOURS,
      cursor: req.nextUrl.searchParams.get("cursor") ?? undefined,
      limit: req.nextUrl.searchParams.get("limit") ?? 50,
    });

    const cutoff = new Date(Date.now() - query.slaHours * 60 * 60 * 1000);

    const submissions = await prisma.fieldSubmission.findMany({
      where: {
        organizationId: orgId,
        status: { in: ["submitted", "under_review"] },
        submittedAt: { lt: cutoff },
      },
      select: {
        id: true,
        status: true,
        documentType: true,
        submittedAt: true,
        reviewClaimedByUserId: true,
        reviewClaimedAt: true,
        submittedBy: { select: { id: true, name: true, email: true } },
        emissionCategory: { select: { id: true, name: true } },
        facility: { select: { id: true, name: true } },
        files: { select: { evidenceFileId: true }, take: 1 },
      },
      orderBy: { submittedAt: "asc" },
      take: query.limit + 1,
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
    });

    const hasMore = submissions.length > query.limit;
    const page = hasMore ? submissions.slice(0, query.limit) : submissions;

    return NextResponse.json({
      submissions: page.map((s) => ({
        ...s,
        hoursOverdue: s.submittedAt
          ? Math.floor((Date.now() - s.submittedAt.getTime()) / 3_600_000) - query.slaHours
          : null,
      })),
      nextCursor: hasMore ? page[page.length - 1].id : null,
      slaHours: query.slaHours,
      totalOverdue: null,
    });
  } catch (err) {
    return handleRouteError(err);
  }
}
