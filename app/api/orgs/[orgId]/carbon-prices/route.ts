export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireOrgMember, ROLE_GROUPS } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/db/audit";
import { handleRouteError } from "@/lib/validation/api";
import { PRICE_TYPES, PRICE_USES } from "@/lib/carbon-price";

const READ_ROLES = [...ROLE_GROUPS.editor, "reviewer", "viewer", "auditor"] as const;

const priceSchema = z
  .object({
    name: z.string().trim().min(1).max(200),
    priceType: z.enum(Object.keys(PRICE_TYPES) as [keyof typeof PRICE_TYPES, ...(keyof typeof PRICE_TYPES)[]]),
    pricePerTonne: z.number().positive().max(100_000),
    currency: z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/, "Use a three-letter currency code.").default("GBP"),
    scopes: z.array(z.union([z.literal(1), z.literal(2), z.literal(3)])).min(1, "Pick at least one scope.").transform((s) => [...new Set(s)].sort()),
    appliesTo: z.array(z.enum(Object.keys(PRICE_USES) as [keyof typeof PRICE_USES, ...(keyof typeof PRICE_USES)[]])).default([]),
    effectiveFrom: z.coerce.date(),
    effectiveTo: z.coerce.date().nullable().default(null),
    basis: z.string().trim().max(4000).nullable().optional(),
  })
  .refine((v) => v.effectiveTo == null || v.effectiveTo >= v.effectiveFrom, {
    message: "The end date must be on or after the start date.",
    path: ["effectiveTo"],
  });

// GET /api/orgs/[orgId]/carbon-prices
export async function GET(_req: NextRequest, { params }: { params: Promise<{ orgId: string }> }) {
  try {
    const { orgId } = await params;
    await requireOrgMember(orgId, ...READ_ROLES);
    const data = await prisma.internalCarbonPrice.findMany({
      where: { organizationId: orgId },
      orderBy: [{ effectiveFrom: "desc" }, { createdAt: "desc" }],
    });
    return NextResponse.json({ data });
  } catch (err) {
    return handleRouteError(err);
  }
}

// POST /api/orgs/[orgId]/carbon-prices
export async function POST(req: NextRequest, { params }: { params: Promise<{ orgId: string }> }) {
  try {
    const { orgId } = await params;
    const { session } = await requireOrgMember(orgId, ...ROLE_GROUPS.editor);
    const body = priceSchema.parse(await req.json());

    const price = await prisma.internalCarbonPrice.create({
      data: { ...body, basis: body.basis ?? null, organizationId: orgId, createdByUserId: session.user.id },
    });

    await writeAuditLog({
      organizationId: orgId,
      actorUserId: session.user.id,
      action: "carbon_price.created",
      resourceType: "InternalCarbonPrice",
      resourceId: price.id,
      metadata: { priceType: body.priceType, pricePerTonne: body.pricePerTonne, currency: body.currency, scopes: body.scopes },
    });

    return NextResponse.json(price, { status: 201 });
  } catch (err) {
    return handleRouteError(err);
  }
}
