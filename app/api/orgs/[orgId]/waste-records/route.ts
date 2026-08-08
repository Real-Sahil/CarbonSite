import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireOrgMember } from "@/lib/auth/session";
import { handleRouteError } from "@/lib/validation/api";
import { writeAuditLog } from "@/lib/db/audit";

// DEFRA 2024 waste emission factors (kgCO2e/tonne) — sourced from DEFRA
// Conversion Factors 2024, table: Waste disposal
const WASTE_FACTORS: Record<string, number> = {
  landfill_mixed:        476.0,
  landfill_food:         581.0,
  landfill_wood:         713.0,
  landfill_plastic:       71.5,
  incineration_efw:       21.3,
  recycling_paper:        21.0,
  recycling_cardboard:    21.0,
  recycling_plastic:      25.7,
  recycling_glass:        10.4,
  recycling_metal:         3.0,
  recycling_mixed:        21.0,
  composting_food:         8.6,
  composting_garden:       5.1,
  anaerobic_digestion:     8.6,
  hazardous_landfill:     36.0,
};

const CreateSchema = z.object({
  projectId: z.string().cuid().optional(),
  wasteType: z.string().min(1).max(100),
  disposalRoute: z.enum([
    "landfill_mixed", "landfill_food", "landfill_wood", "landfill_plastic",
    "incineration_efw", "recycling_paper", "recycling_cardboard", "recycling_plastic",
    "recycling_glass", "recycling_metal", "recycling_mixed",
    "composting_food", "composting_garden", "anaerobic_digestion", "hazardous_landfill",
  ]),
  weightTonnes: z.number().positive(),
  ewcCode: z.string().max(20).optional(),
  carrierName: z.string().max(200).optional(),
  recordedAt: z.string().datetime(),
  notes: z.string().max(1000).optional(),
});

type Params = { params: Promise<{ orgId: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  try {
    const { orgId } = await params;
    await requireOrgMember(orgId, "admin", "sustainability_director", "sustainability_manager",
      "contract_manager", "project_manager", "site_manager", "editor", "viewer", "auditor");

    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get("projectId");
    const cursor = searchParams.get("cursor");
    const limit = Math.min(Number(searchParams.get("limit") ?? "50"), 100);

    const records = await prisma.wasteRecord.findMany({
      where: {
        organizationId: orgId,
        ...(projectId ? { projectId } : {}),
        ...(cursor ? { recordedAt: { lt: new Date(cursor) } } : {}),
      },
      orderBy: { recordedAt: "desc" },
      take: limit + 1,
    });

    const hasMore = records.length > limit;
    const data = hasMore ? records.slice(0, limit) : records;
    const nextCursor = hasMore ? data[data.length - 1]?.recordedAt.toISOString() : null;

    const totals = await prisma.wasteRecord.aggregate({
      where: { organizationId: orgId, ...(projectId ? { projectId } : {}) },
      _sum: { weightTonnes: true, co2eTonnes: true },
    });

    return NextResponse.json({
      data,
      nextCursor,
      totalWeightTonnes: Number(totals._sum.weightTonnes ?? 0),
      totalCo2eTonnes: Number(totals._sum.co2eTonnes ?? 0),
    });
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { orgId } = await params;
    const { session } = await requireOrgMember(orgId, "admin", "sustainability_director",
      "sustainability_manager", "contract_manager", "project_manager", "site_manager", "editor");

    const body = CreateSchema.parse(await req.json());

    // Auto-calculate CO2e using DEFRA factors
    const factorKgPerTonne = WASTE_FACTORS[body.disposalRoute] ?? 0;
    const co2eTonnes = (body.weightTonnes * factorKgPerTonne) / 1000;

    const record = await prisma.wasteRecord.create({
      data: {
        organizationId: orgId,
        projectId: body.projectId,
        wasteType: body.wasteType,
        disposalRoute: body.disposalRoute,
        weightTonnes: body.weightTonnes,
        co2eTonnes,
        ewcCode: body.ewcCode,
        carrierName: body.carrierName,
        recordedAt: new Date(body.recordedAt),
        notes: body.notes,
      },
    });

    await writeAuditLog({
      organizationId: orgId,
      actorUserId: session.user.id,
      action: "record.created",
      resourceType: "waste_record",
      resourceId: record.id,
      metadata: { disposalRoute: body.disposalRoute, weightTonnes: body.weightTonnes, co2eTonnes },
    });

    return NextResponse.json(record, { status: 201 });
  } catch (err) {
    return handleRouteError(err);
  }
}
