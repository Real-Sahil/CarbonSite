export const dynamic = "force-dynamic";

// Search the industry codes that spend factors exist for (shared, read-only
// reference data): 6-digit NAICS (EPA USEEIO) and NAF / UK SIC divisions
// (ADEME), for the record form's industry code field.

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireOrgMember, ROLE_GROUPS } from "@/lib/auth/session";
import { handleRouteError } from "@/lib/validation/api";

function describe(activityType: string, notes: string | null) {
  const naics = activityType.match(/^naics_(\d{6})$/)?.[1];
  if (naics) return { code: naics, scheme: "NAICS", title: (notes ?? "").match(/^NAICS \d{6}, (.*?)\. EPA/)?.[1] ?? "" };
  const naf = activityType.match(/^naf_(\d{2})$/)?.[1];
  if (naf) return { code: naf, scheme: "NAF/SIC", title: (notes ?? "").match(/^NAF \d{2}: (.*?)\. \d/)?.[1] ?? "" };
  return null;
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ orgId: string }> }) {
  try {
    const { orgId } = await params;
    await requireOrgMember(orgId, ...ROLE_GROUPS.anyMember);
    const q = (req.nextUrl.searchParams.get("q") ?? "").trim().slice(0, 80);
    const digits = /^\d{2,6}$/.test(q) ? q : null;
    const prefixes = digits ? [`naics_${digits}`, ...(digits.length === 2 ? [`naf_${digits}`] : [])] : ["naics_", "naf_"];
    const rows = await prisma.emissionFactor.findMany({
      where: {
        OR: prefixes.map((p) => ({ activityType: { startsWith: p } })),
        ...(q && !digits ? { usageNotes: { contains: q, mode: "insensitive" as const } } : {}),
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
