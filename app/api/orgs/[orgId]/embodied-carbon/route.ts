import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireOrgMember } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { writeAuditLog } from "@/lib/db/audit";
import { calculateEmbodiedCarbon } from "@/lib/embodied-carbon/engine";
import { handleRouteError, apiError } from "@/lib/validation/api";

const CreateSchema = z.object({
  materialId: z.string().optional(),
  epdId: z.string().optional(),
  projectId: z.string().optional(),
  reportingPeriodId: z.string().optional(),
  description: z.string().max(500).optional(),
  quantity: z.number().positive(),
  unit: z.enum(["kg", "tonne", "m3", "m2"]),
  stages: z.array(z.enum(["A1-A3", "A4", "A5", "C1-C4", "D"])).optional(),
  notes: z.string().max(1000).optional(),
});

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ orgId: string }> },
) {
  const { orgId } = await params;
  try {
    await requireOrgMember(orgId, "admin", "editor", "reviewer", "viewer", "auditor");

    const records = await prisma.embodiedCarbonRecord.findMany({
      where: { organizationId: orgId },
      include: {
        material: { select: { id: true, name: true, category: true } },
        epd: { select: { id: true, productName: true, manufacturer: true } },
        project: { select: { id: true, name: true } },
        reportingPeriod: { select: { id: true, label: true } },
        createdBy: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    });

    const totalKgCo2e = records.reduce((s, r) => s + r.totalKgCo2e, 0);

    return NextResponse.json({ records, totalKgCo2e });
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ orgId: string }> },
) {
  const { orgId } = await params;
  try {
    const { session } = await requireOrgMember(orgId, "admin", "editor");
    const userId = session.user.id;

    const body = await req.json();
    const parsed = CreateSchema.safeParse(body);
    if (!parsed.success) {
      return apiError("VALIDATION_ERROR", "Invalid request body", 400, parsed.error.flatten());
    }
    const data = parsed.data;

    if (!data.materialId && !data.epdId) {
      return apiError("MISSING_MATERIAL", "Either materialId or epdId is required", 400);
    }

    // Resolve factors
    let factors: Parameters<typeof calculateEmbodiedCarbon>[0]["factors"] | null = null;

    if (data.epdId) {
      const epd = await prisma.epdRecord.findFirst({
        where: { id: data.epdId, organizationId: orgId },
      });
      if (!epd) return apiError("EPD_NOT_FOUND", "EPD record not found", 404);
      factors = {
        gwpA1A3: epd.gwpA1A3,
        gwpA4: epd.gwpA4,
        gwpA5: epd.gwpA5,
        gwpC1C4: epd.gwpC1C4,
        gwpD: epd.gwpD,
        declaredUnit: epd.declaredUnit,
      };
    } else if (data.materialId) {
      const mat = await prisma.embodiedMaterial.findUnique({ where: { id: data.materialId } });
      if (!mat) return apiError("MATERIAL_NOT_FOUND", "Material not found", 404);
      factors = {
        gwpA1A3: mat.gwpA1A3,
        gwpA4: mat.gwpA4,
        gwpA5: mat.gwpA5,
        gwpC1C4: mat.gwpC1C4,
        gwpD: mat.gwpD,
        declaredUnit: mat.declaredUnit,
        density: mat.density,
      };
    }

    if (!factors) return apiError("NO_FACTORS", "Could not resolve emission factors", 400);

    const result = calculateEmbodiedCarbon({
      quantity: data.quantity,
      unit: data.unit,
      factors,
      stages: data.stages,
    });

    const record = await prisma.embodiedCarbonRecord.create({
      data: {
        organizationId: orgId,
        projectId: data.projectId,
        reportingPeriodId: data.reportingPeriodId,
        materialId: data.materialId,
        epdId: data.epdId,
        description: data.description,
        quantity: data.quantity,
        unit: data.unit,
        gwpA1A3Used: result.gwpA1A3Used,
        gwpA4Used: result.gwpA4Used,
        totalKgCo2e: result.totalKgCo2e,
        lifecycleStages: data.stages ?? ["A1-A3"],
        notes: data.notes,
        createdByUserId: userId,
      },
      include: {
        material: { select: { id: true, name: true, category: true } },
      },
    });

    await writeAuditLog({
      organizationId: orgId,
      actorUserId: userId,
      action: "embodied_carbon.record_created",
      resourceType: "EmbodiedCarbonRecord",
      resourceId: record.id,
      metadata: { totalKgCo2e: result.totalKgCo2e, stages: data.stages },
    });

    return NextResponse.json({ record, result }, { status: 201 });
  } catch (err) {
    return handleRouteError(err);
  }
}
