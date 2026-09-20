export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { apiError, handleRouteError } from "@/lib/validation/api";

type Params = { params: Promise<{ token: string }> };

/**
 * GET /api/public/snapshots/[token]
 * Unauthenticated read-only view of a published snapshot via share link.
 * Returns aggregate totals only — no record-level detail, no evidence.
 */
export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { token } = await params;

    const snapshot = await prisma.publishedSnapshot.findUnique({
      where: { shareToken: token },
      select: {
        id: true,
        publishedAt: true,
        version: true,
        shareTokenExpiresAt: true,
        organization: { select: { name: true, industry: true, hqCountry: true } },
        reportingPeriod: {
          select: { label: true, startDate: true, endDate: true, type: true },
        },
        aggregates: {
          where: {
            facilityId: null,
            businessUnitId: null,
            emissionCategoryId: null,
          },
          select: { scope: true, totalCo2e: true, recordCount: true },
        },
      },
    });

    if (!snapshot) return apiError("NOT_FOUND", "Share link is invalid or has been revoked.", 404);

    if (snapshot.shareTokenExpiresAt && snapshot.shareTokenExpiresAt < new Date()) {
      return apiError("EXPIRED", "This share link has expired. Ask the organisation to regenerate it.", 410);
    }

    const scopeMap = Object.fromEntries(
      snapshot.aggregates.map((a) => [a.scope, { totalCo2e: a.totalCo2e, recordCount: a.recordCount }]),
    );
    const totals = {
      scope1Co2e: scopeMap[1]?.totalCo2e ?? null,
      scope2Co2e: scopeMap[2]?.totalCo2e ?? null,
      scope3Co2e: scopeMap[3]?.totalCo2e ?? null,
      totalCo2e: snapshot.aggregates.reduce((s, a) => s + Number(a.totalCo2e), 0),
      recordCount: snapshot.aggregates.reduce((s, a) => s + a.recordCount, 0),
    };

    const { shareTokenExpiresAt, aggregates, ...meta } = snapshot;
    return NextResponse.json({ snapshot: { ...meta, totals } });
  } catch (err) {
    return handleRouteError(err);
  }
}
