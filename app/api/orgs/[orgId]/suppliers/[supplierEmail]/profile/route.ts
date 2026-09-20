import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireOrgMember } from "@/lib/auth/session";
import { handleRouteError } from "@/lib/validation/api";
import { writeAuditLog } from "@/lib/db/audit";
import { nanoid } from "nanoid";

const UpsertSchema = z.object({
  supplierName: z.string().optional().nullable(),
  companyNumber: z.string().optional().nullable(),
  livingWageDeclared: z.boolean().optional(),
  livingWageDeclaredAt: z.string().optional().nullable(),
  livingWageExpiresAt: z.string().optional().nullable(),
  wasteCarrierRegistration: z.string().optional().nullable(),
  wasteCarrierExpiresAt: z.string().optional().nullable(),
  iso14001Certified: z.boolean().optional(),
  iso14001ExpiresAt: z.string().optional().nullable(),
  iso45001Certified: z.boolean().optional(),
  iso45001ExpiresAt: z.string().optional().nullable(),
  modernSlaveryStatement: z.boolean().optional(),
  modernSlaveryStatementYear: z.number().int().optional().nullable(),
  ssipAccreditation: z.string().optional().nullable(),
  ssipExpiresAt: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export async function GET(_req: NextRequest, { params }: { params: Promise<{ orgId: string; supplierEmail: string }> }) {
  try {
    const { orgId, supplierEmail } = await params;
    await requireOrgMember(orgId, "admin", "editor", "reviewer", "viewer", "auditor");

    const email = decodeURIComponent(supplierEmail);
    const profile = await prisma.supplierProfile.findUnique({
      where: { organizationId_supplierEmail: { organizationId: orgId, supplierEmail: email } },
    });

    if (!profile) return NextResponse.json({ data: null });
    return NextResponse.json({ data: profile });
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ orgId: string; supplierEmail: string }> }) {
  try {
    const { orgId, supplierEmail } = await params;
    const { session } = await requireOrgMember(orgId, "admin", "editor");

    const email = decodeURIComponent(supplierEmail);
    const body = UpsertSchema.parse(await req.json());

    const d = (v: string | null | undefined) => v ? new Date(v) : null;

    const profile = await prisma.supplierProfile.upsert({
      where: { organizationId_supplierEmail: { organizationId: orgId, supplierEmail: email } },
      create: {
        id: nanoid(),
        organizationId: orgId,
        supplierEmail: email,
        supplierName: body.supplierName ?? null,
        companyNumber: body.companyNumber ?? null,
        livingWageDeclared: body.livingWageDeclared ?? false,
        livingWageDeclaredAt: d(body.livingWageDeclaredAt),
        livingWageExpiresAt: d(body.livingWageExpiresAt),
        wasteCarrierRegistration: body.wasteCarrierRegistration ?? null,
        wasteCarrierExpiresAt: d(body.wasteCarrierExpiresAt),
        iso14001Certified: body.iso14001Certified ?? false,
        iso14001ExpiresAt: d(body.iso14001ExpiresAt),
        iso45001Certified: body.iso45001Certified ?? false,
        iso45001ExpiresAt: d(body.iso45001ExpiresAt),
        modernSlaveryStatement: body.modernSlaveryStatement ?? false,
        modernSlaveryStatementYear: body.modernSlaveryStatementYear ?? null,
        ssipAccreditation: body.ssipAccreditation ?? null,
        ssipExpiresAt: d(body.ssipExpiresAt),
        notes: body.notes ?? null,
      },
      update: {
        ...(body.supplierName !== undefined && { supplierName: body.supplierName }),
        ...(body.companyNumber !== undefined && { companyNumber: body.companyNumber }),
        ...(body.livingWageDeclared !== undefined && { livingWageDeclared: body.livingWageDeclared }),
        ...(body.livingWageDeclaredAt !== undefined && { livingWageDeclaredAt: d(body.livingWageDeclaredAt) }),
        ...(body.livingWageExpiresAt !== undefined && { livingWageExpiresAt: d(body.livingWageExpiresAt) }),
        ...(body.wasteCarrierRegistration !== undefined && { wasteCarrierRegistration: body.wasteCarrierRegistration }),
        ...(body.wasteCarrierExpiresAt !== undefined && { wasteCarrierExpiresAt: d(body.wasteCarrierExpiresAt) }),
        ...(body.iso14001Certified !== undefined && { iso14001Certified: body.iso14001Certified }),
        ...(body.iso14001ExpiresAt !== undefined && { iso14001ExpiresAt: d(body.iso14001ExpiresAt) }),
        ...(body.iso45001Certified !== undefined && { iso45001Certified: body.iso45001Certified }),
        ...(body.iso45001ExpiresAt !== undefined && { iso45001ExpiresAt: d(body.iso45001ExpiresAt) }),
        ...(body.modernSlaveryStatement !== undefined && { modernSlaveryStatement: body.modernSlaveryStatement }),
        ...(body.modernSlaveryStatementYear !== undefined && { modernSlaveryStatementYear: body.modernSlaveryStatementYear }),
        ...(body.ssipAccreditation !== undefined && { ssipAccreditation: body.ssipAccreditation }),
        ...(body.ssipExpiresAt !== undefined && { ssipExpiresAt: d(body.ssipExpiresAt) }),
        ...(body.notes !== undefined && { notes: body.notes }),
      },
    });

    await writeAuditLog({
      organizationId: orgId, actorUserId: session.user.id,
      action: "supplier_profile.upserted", resourceType: "SupplierProfile", resourceId: profile.id,
      metadata: { supplierEmail: email },
    });

    return NextResponse.json({ data: profile });
  } catch (err) {
    return handleRouteError(err);
  }
}
