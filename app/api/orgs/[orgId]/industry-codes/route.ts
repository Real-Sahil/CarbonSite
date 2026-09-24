export const dynamic = "force-dynamic";

// Search the industry codes that spend factors exist for (shared, read-only
// reference data): 6-digit NAICS (EPA USEEIO), NAF divisions (ADEME) and
// UK SIC 2007 groups (Defra UK spend multipliers), for the record form's
// industry code field.

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireOrgMember, ROLE_GROUPS } from "@/lib/auth/session";
import { handleRouteError } from "@/lib/validation/api";

function describe(activityType: string, notes: string | null) {
  const naics = activityType.match(/^naics_(\d{6})$/)?.[1];
  if (naics) return { code: naics, scheme: "NAICS", title: (notes ?? "").match(/^NAICS \d{6}, (.*?)\. EPA/)?.[1] ?? "" };
  const naf = activityType.match(/^naf_(\d{2})$/)?.[1];
  if (naf) return { code: naf, scheme: "NAF/SIC", title: (notes ?? "").match(/^NAF \d{2}: (.*?)\. \d/)?.[1] ?? "" };
  const sic = activityType.match(/^uksic_(.+)$/)?.[1];
  if (sic) return { code: sic, scheme: "UK SIC", title: (notes ?? "").match(/^UK SIC [^:]+: (.*?)\. \d{4} multiplier/)?.[1] ?? "" };
  return null;
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ orgId: string }> }) {
  try {
    const { orgId } = await params;
    await requireOrgMember(orgId, ...ROLE_GROUPS.anyMember);
    const q = (req.nextUrl.searchParams.get("q") ?? "").trim().slice(0, 80);
    const digits = /^\d{2,6}$/.test(q) ? q : null;
    // "41.20" searches as 41; UK SIC groups are keyed by division (uksic_41, uksic_10.1...).
    const division = /^\d{2}([.\s]\d*)?$/.test(q) ? q.slice(0, 2) : digits?.slice(0, 2) ?? null;
    const sicDiv = division ? String(Number(division)) : null;
    const match = digits || division
      ? [
          ...(digits ? [{ activityType: { startsWith: `naics_${digits}` } }] : []),
          ...(division && sicDiv && (!digits || digits.length <= 5)
            ? [
                { activityType: { equals: `naf_${division}` } },
                { activityType: { equals: `uksic_${sicDiv}` } },
                // Groups within the division: uksic_10.1, uksic_20A, uksic_23OTHER.
                ...[".", "A", "B", "C", "O"].map((c) => ({ activityType: { startsWith: `uksic_${sicDiv}${c}` } })),
              ]
            : []),
        ]
      : ["naics_", "naf_", "uksic_"].map((p) => ({ activityType: { startsWith: p } }));
    const rows = await prisma.emissionFactor.findMany({
      where: {
        OR: match,
        ...(q && !digits && !division ? { usageNotes: { contains: q, mode: "insensitive" as const } } : {}),
      },
      select: { activityType: true, usageNotes: true },
      distinct: ["activityType"],
      orderBy: { activityType: "asc" },
      take: 25,
    });
    const data = rows.map((r) => describe(r.activityType ?? "", r.usageNotes)).filter(Boolean);
    return NextResponse.json({ data });
  } catch (err) {
    return handleRouteError(err);
  }
}
