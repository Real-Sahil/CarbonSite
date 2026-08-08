import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireOrgMember } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/db/audit";
import { handleRouteError, apiError } from "@/lib/validation/api";

const CreateSchema = z.object({
  provider:       z.string().min(1).max(200),
  projectName:    z.string().min(1).max(500),
  projectType:    z.enum(["forestry", "renewable_energy", "methane_capture", "blue_carbon", "soil_carbon", "direct_air_capture", "other"]),
  standard:       z.enum(["VCS", "Gold_Standard", "REDD+", "Plan_Vivo", "ACR", "CAR", "Other"]).default("VCS"),
  vintage:        z.number().int().min(2000).max(2050),
  quantityTonnes: z.number().positive(),
  pricePerTonne:  z.number().positive().optional(),
  currency:       z.string().length(3).default("GBP"),
  purchasedAt:    z.string().datetime(),
  serialNumbers:  z.string().max(1000).optional(),
  retirementRef:  z.string().max(500).optional(),
  notes:          z.string().max(2000).optional(),
});

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ orgId: string }> },
) {
  try {
    const { orgId } = await params;
    await requireOrgMember(orgId, "admin", "editor", "viewer", "auditor");

    const offsets = await prisma.carbonOffset.findMany({
      where: { organizationId: orgId },
      orderBy: { purchasedAt: "desc" },
    });

    const totalTonnes = offsets.reduce((sum, o) => sum + Number(o.quantityTonnes), 0);

    return NextResponse.json({ data: offsets, totalTonnes });
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ orgId: string }> },
) {
  try {
    const { orgId } = await params;
    const { session } = await requireOrgMember(orgId, "admin", "editor");

    const body = CreateSchema.safeParse(await req.json());
    if (!body.success) {
      return apiError("VALIDATION_ERROR", "Invalid offset data", 400, body.error.flatten());
    }

    const offset = await prisma.carbonOffset.create({
      data: {
        organizationId: orgId,
        provider:       body.data.provider,
        projectName:    body.data.projectName,
        projectType:    body.data.projectType,
        standard:       body.data.standard,
        vintage:        body.data.vintage,
        quantityTonnes: body.data.quantityTonnes,
        pricePerTonne:  body.data.pricePerTonne ?? null,
        currency:       body.data.currency,
        purchasedAt:    new Date(body.data.purchasedAt),
        serialNumbers:  body.data.serialNumbers ?? null,
        retirementRef:  body.data.retirementRef ?? null,
        notes:          body.data.notes ?? null,
      },
    });

    await writeAuditLog({
      organizationId: orgId,
      actorUserId: session.user.id,
      action: "record.created",
      resourceType: "carbon_offset",
      resourceId: offset.id,
      metadata: { projectName: offset.projectName, quantityTonnes: String(offset.quantityTonnes) },
    });

    return NextResponse.json(offset, { status: 201 });
  } catch (err) {
    return handleRouteError(err);
  }
}
