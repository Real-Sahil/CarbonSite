import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireOrgMember, ROLE_GROUPS } from "@/lib/auth/session";
import { handleRouteError } from "@/lib/validation/api";
import { getSupplierMetrics } from "@/lib/suppliers/metrics-aggregator";

const metricsQuerySchema = z.object({
  period: z.string().optional().default("30"),
});

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ orgId: string }> },
) {
  try {
    const { orgId } = await params;
    await requireOrgMember(orgId, ...ROLE_GROUPS.admins);

    const { searchParams } = new URL(req.url);
    const query = metricsQuerySchema.parse({
      period: searchParams.get("period") || "30",
    });

    const period = Math.max(7, Math.min(365, parseInt(query.period)));
    const metrics = await getSupplierMetrics(orgId, period);

    return NextResponse.json(metrics);
  } catch (err) {
    return handleRouteError(err);
  }
}
