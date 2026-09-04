export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireOrgMember } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/db/audit";
import { handleRouteError } from "@/lib/validation/api";

const epdSchema = z.object({
  productName: z.string().min(1).max(200).trim(),
  manufacturer: z.string().max(200).trim().optional(),
  materialId: z.string().optional(),
  declaredUnit: z.enum(["kg", "tonne", "m3", "m2", "piece"]).default("kg"),
  gwpA1A3: z.number().nonnegative(),
  gwpA4: z.number().nonnegative().optional(),
  gwpA5: z.number().nonnegative().optional(),
  gwpC1C4: z.number().nonnegative().optional(),
  /** Granular end-of-life stages, used in preference to gwpC1C4 by the whole-life carbon module when set. */
  gwpC1: z.number().nonnegative().optional(),
  gwpC2: z.number().nonnegative().optional(),
  gwpC3: z.number().nonnegative().optional(),
  gwpC4: z.number().nonnegative().optional(),
  gwpD: z.number().optional(),
  /** Years between replacements over a building's study period — drives module B4 in the whole-life carbon assessment. */
  replacementCycleYears: z.number().int().positive().optional(),
  validFrom: z.string().datetime().optional(),
  validUntil: z.string().datetime().optional(),
  storageKey: z.string().optional(),
});

// GET /api/orgs/[orgId]/supplier-portal/epds
// Suppliers see only their own submissions; privileged roles see all.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ orgId: string }> },
) {
  try {
    const { orgId } = await params;
    const { session, membership } = await requireOrgMember(
      orgId,
      "supplier", "admin", "editor", "reviewer", "auditor",
    );

    const supplierOnly = membership.role === "supplier";

    const epds = await prisma.epdRecord.findMany({
      where: {
        organizationId: orgId,
        ...(supplierOnly ? { submittedByUserId: session.user.id } : {}),
      },
      select: {
        id: true,
        productName: true,
        manufacturer: true,
        declaredUnit: true,
        gwpA1A3: true,
        gwpA4: true,
        gwpA5: true,
        gwpC1C4: true,
        gwpC1: true,
        gwpC2: true,
        gwpC3: true,
        gwpC4: true,
        gwpD: true,
        replacementCycleYears: true,
        validFrom: true,
        validUntil: true,
        createdAt: true,
        submittedByUserId: true,
        material: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(epds);
  } catch (err) {
    return handleRouteError(err);
  }
}

// POST /api/orgs/[orgId]/supplier-portal/epds — submit a new EPD
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ orgId: string }> },
) {
  try {
    const { orgId } = await params;
    const { session } = await requireOrgMember(orgId, "supplier", "admin", "editor");

    const body = epdSchema.parse(await req.json());

    const epd = await prisma.epdRecord.create({
      data: {
        organizationId: orgId,
        productName: body.productName,
        manufacturer: body.manufacturer ?? null,
        materialId: body.materialId ?? null,
        declaredUnit: body.declaredUnit,
        gwpA1A3: body.gwpA1A3,
        gwpA4: body.gwpA4 ?? null,
        gwpA5: body.gwpA5 ?? null,
        gwpC1C4: body.gwpC1C4 ?? null,
        gwpC1: body.gwpC1 ?? null,
        gwpC2: body.gwpC2 ?? null,
        gwpC3: body.gwpC3 ?? null,
        gwpC4: body.gwpC4 ?? null,
        gwpD: body.gwpD ?? null,
        replacementCycleYears: body.replacementCycleYears ?? null,
        validFrom: body.validFrom ? new Date(body.validFrom) : null,
        validUntil: body.validUntil ? new Date(body.validUntil) : null,
        storageKey: body.storageKey ?? null,
        submittedByUserId: session.user.id,
      },
    });

    await writeAuditLog({
      organizationId: orgId,
      actorUserId: session.user.id,
      action: "epd.submitted",
      resourceType: "EpdRecord",
      resourceId: epd.id,
      metadata: { productName: epd.productName, manufacturer: epd.manufacturer },
    });

    return NextResponse.json(epd, { status: 201 });
  } catch (err) {
    return handleRouteError(err);
  }
}
