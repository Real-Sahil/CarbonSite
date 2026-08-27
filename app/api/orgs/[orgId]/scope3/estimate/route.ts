import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireOrgMember } from "@/lib/auth/session";
import { estimateScope3, suggestScope3Category } from "@/lib/calculation/scope3-estimator";
import { handleRouteError } from "@/lib/validation/api";

const estimateSchema = z.object({
  spendCategory: z.string().optional(),
  spendAmount: z.number().min(0).optional(),
  currency: z.string().default("GBP"),
  orgRevenue: z.number().optional(),
  industry: z.string().optional(),
  employees: z.number().optional(),
  facilities: z.number().optional(),
  description: z.string().optional(),
});

const suggestCategorySchema = z.object({
  description: z.string().min(1),
  industry: z.string().optional(),
});

export async function POST(req: NextRequest, { params }: { params: { orgId: string } }) {
  try {
    const { orgId } = params;
    await requireOrgMember(orgId, "admin", "editor", "auditor");

    const body = await req.json();
    const { operation } = z.object({ operation: z.enum(["estimate", "suggest"]) }).parse({
      operation: body.operation || "estimate",
    });

    if (operation === "suggest") {
      const { description, industry } = suggestCategorySchema.parse(body);
      const category = await suggestScope3Category(description, industry);
      return NextResponse.json({ category }, { status: 200 });
    }

    // estimate operation
    const input = estimateSchema.parse(body);
    const estimate = await estimateScope3({
      organizationId: orgId,
      ...input,
    });

    return NextResponse.json(
      {
        success: true,
        estimate,
      },
      { status: 200 },
    );
  } catch (err) {
    return handleRouteError(err);
  }
}
