export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireOrgMember } from "@/lib/auth/session";
import { handleRouteError } from "@/lib/validation/api";

type Params = { params: Promise<{ orgId: string }> };

// GET /api/orgs/[orgId]/reporting-periods — list reporting periods for approval dropdowns
export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { orgId } = await params;
    await requireOrgMember(orgId, "admin", "editor", "reviewer");

    const periods = await prisma.reportingPeriod.findMany({
      where: { organizationId: orgId },
      select: {
        id: true,
        type: true,
        startDate: true,
        endDate: true,
      },
      orderBy: { startDate: "desc" },
    });

    const formatted = periods.map((p) => {
      const year = p.startDate.getFullYear();
      let label = `${year}`;

      if (p.type === "quarter") {
        const month = p.startDate.getMonth();
        const quarter = Math.floor(month / 3) + 1;
        label += ` Q${quarter}`;
      } else if (p.type === "month") {
        label += ` ${p.startDate.toLocaleString("en-US", { month: "short" })}`;
      }

      return {
        id: p.id,
        label,
        startDate: p.startDate.toISOString().split("T")[0],
        endDate: p.endDate.toISOString().split("T")[0],
        type: p.type,
      };
    });

    return NextResponse.json({ periods: formatted });
  } catch (err) {
    return handleRouteError(err);
  }
}
