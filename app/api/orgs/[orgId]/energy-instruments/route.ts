export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireOrgMember, ROLE_GROUPS } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/db/audit";
import { apiError, handleRouteError } from "@/lib/validation/api";

const READ_ROLES = [...ROLE_GROUPS.editor, "reviewer", "viewer", "auditor"] as const;

const instrumentSchema = z
  .object({
    type: z.enum(["rego", "guarantee_of_origin", "ppa", "green_tariff", "supplier_specific", "residual_mix"]),
    facilityId: z.string().min(1).nullable().default(null),
    supplierName: z.string().trim().max(200).nullable().optional(),
    reference: z.string().trim().max(200).nullable().optional(),
    coveredKwh: z.number().positive().nullable().default(null),
    emissionFactorKgPerKwh: z.number().min(0).max(2),
    validFrom: z.coerce.date(),
    validTo: z.coerce.date(),
    notes: z.string().trim().max(2000).nullable().optional(),
  })
  .refine((v) => v.validTo >= v.validFrom, { message: "The end date must be on or after the start date.", path: ["validTo"] })
  .refine((v) => !["rego", "guarantee_of_origin", "ppa"].includes(v.type) || v.coveredKwh != null, {
    message: "Certificates and PPAs cover a fixed volume. Enter the kWh they cover.",
    path: ["coveredKwh"],
  });

// GET /api/orgs/[orgId]/energy-instruments
export async function GET(_req: NextRequest, { params }: { params: Promise<{ orgId: string }> }) {
  try {
    const { orgId } = await params;
    await requireOrgMember(orgId, ...READ_ROLES);
    const data = await prisma.energyInstrument.findMany({
      where: { organizationId: orgId },
      include: { facility: { select: { name: true } } },
      orderBy: [{ validFrom: "desc" }, { createdAt: "desc" }],
    });
    return NextResponse.json({ data });
  } catch (err) {
    return handleRouteError(err);
  }
}

// POST /api/orgs/[orgId]/energy-instruments
export async function POST(req: NextRequest, { params }: { params: Promise<{ orgId: string }> }) {
  try {
    const { orgId } = await params;
    const { session } = await requireOrgMember(orgId, ...ROLE_GROUPS.editor);
    const body = instrumentSchema.parse(await req.json());

    if (body.facilityId) {
      const facility = await prisma.facility.findFirst({
        where: { id: body.facilityId, organizationId: orgId },
        select: { id: true },
      });
      if (!facility) return apiError("FACILITY_NOT_FOUND", "That site is not in this organisation.", 404);
    }

    const instrument = await prisma.energyInstrument.create({
      data: { ...body, organizationId: orgId, createdByUserId: session.user.id },
    });

    await writeAuditLog({
      organizationId: orgId,
      actorUserId: session.user.id,
      action: "energy_instrument.created",
      resourceType: "energy_instrument",
      resourceId: instrument.id,
      metadata: { type: body.type, reference: body.reference ?? null, coveredKwh: body.coveredKwh },
    });

    return NextResponse.json(instrument, { status: 201 });
  } catch (err) {
    return handleRouteError(err);
  }
}
