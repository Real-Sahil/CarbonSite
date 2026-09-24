export const dynamic = "force-dynamic";

// Search the named heat and cooling networks factors exist for (shared,
// read-only reference data: ADEME Base Carbone), for the record form's heat
// network field. The value returned is what the record stores in fuelType,
// which pickHeatNetwork() (lib/calculation/heat-network.ts) matches: the
// network name, with "cooling" added for a cooling network.

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireOrgMember, ROLE_GROUPS } from "@/lib/auth/session";
import { handleRouteError } from "@/lib/validation/api";
import { networkName } from "@/lib/calculation/heat-network";

export async function GET(req: NextRequest, { params }: { params: Promise<{ orgId: string }> }) {
  try {
    const { orgId } = await params;
    await requireOrgMember(orgId, ...ROLE_GROUPS.anyMember);
    const q = (req.nextUrl.searchParams.get("q") ?? "").trim().slice(0, 80);
    if (q.length < 2) return NextResponse.json({ data: [] });
    const rows = await prisma.emissionFactor.findMany({
      where: {
        activityType: { in: ["heat_network", "cooling_network"] },
        usageNotes: { contains: q, mode: "insensitive" },
      },
      select: { activityType: true, usageNotes: true, co2e: true },
      orderBy: { usageNotes: "asc" },
      take: 20,
    });
    const data = rows.flatMap((r) => {
      const name = networkName(r);
      if (!name) return [];
      const cooling = r.activityType === "cooling_network";
      return [{
        value: cooling ? `${name} cooling` : name,
        label: `${cooling ? "Cooling" : "Heat"} · ${Number(r.co2e ?? 0)} kg CO2e/kWh`,
      }];
    });
    return NextResponse.json({ data });
  } catch (err) {
    return handleRouteError(err);
  }
}
