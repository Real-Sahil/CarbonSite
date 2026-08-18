export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePlatformMember } from "@/lib/auth/session";
import { handleRouteError } from "@/lib/validation/api";

export async function GET() {
  try {
    await requirePlatformMember();
    const libraries = await prisma.factorLibrary.findMany({
      include: { _count: { select: { factors: true } } },
      orderBy: [{ name: "asc" }, { version: "desc" }],
    });
    return NextResponse.json(libraries);
  } catch (err) {
    return handleRouteError(err);
  }
}

// Upsert the two standard factor libraries (DEFRA and EPA).
// Safe to call repeatedly — idempotent via unique name+version constraint.
export async function POST() {
  try {
    await requirePlatformMember();

    const [defra, epa] = await Promise.all([
      prisma.factorLibrary.upsert({
        where: { name_version: { name: "DEFRA", version: "2025.1" } },
        update: {},
        create: {
          name: "DEFRA",
          version: "2025.1",
          license: "Open Government Licence v3.0",
          sourceUrl:
            "https://www.gov.uk/government/collections/government-conversion-factors-for-company-reporting",
          publishedAt: new Date("2025-06-01"),
        },
      }),
      prisma.factorLibrary.upsert({
        where: { name_version: { name: "EPA", version: "2025.1" } },
        update: {},
        create: {
          name: "EPA",
          version: "2025.1",
          license: "Public Domain (US Government Work)",
          sourceUrl: "https://www.epa.gov/climateleadership/ghg-emission-factors-hub",
          publishedAt: new Date("2025-01-01"),
        },
      }),
    ]);

    return NextResponse.json({ defra, epa });
  } catch (err) {
    return handleRouteError(err);
  }
}
