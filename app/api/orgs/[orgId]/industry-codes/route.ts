export const dynamic = "force-dynamic";

// Search the NAICS codes that spend-by-industry factors exist for (shared,
// read-only reference data), for the record form's industry code field.

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireOrgMember, ROLE_GROUPS } from "@/lib/auth/session";
import { handleRouteError } from "@/lib/validation/api";

const titleOf = (notes: string | null, code: string) =>
  (notes ?? "").match(new RegExp(`^NAICS ${code}, (.*?)\\. EPA`))?.[1] ?? "";

export async function GET(req: NextRequest, { params }: { params: Promise<{ orgId: string }> }) {
  try {
    const { orgId } = await params;
    await requireOrgMember(orgId, ...ROLE_GROUPS.anyMember);
    const q = (req.nextUrl.searchParams.get("q") ?? "").trim().slice(0, 80);
    const digits = /^\d{2,6}$/.test(q) ? q : null;
    const rows = await prisma.emissionFactor.findMany({
      where: {
        activityType: digits ? { startsWith: `naics_${digits}` } : { startsWith: "naics_" },
        ...(q && !digits ? { usageNotes: { contains: q, mode: "insensitive" as const } } : {}),
      },
      select: { activityType: true, usageNotes: true },
      distinct: ["activityType"],
      orderBy: { activityType: "asc" },
      take: 25,
    });
    const data = rows.map((r) => {
      const code = (r.activityType ?? "").slice("naics_".length);
      return { code, title: titleOf(r.usageNotes, code) };
    });
    return NextResponse.json({ data });
  } catch (err) {
    return handleRouteError(err);
  }
}
