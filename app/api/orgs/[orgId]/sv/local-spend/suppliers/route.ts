export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Decimal } from "@prisma/client/runtime/library";
import { prisma } from "@/lib/db";
import { requireOrgMember, ROLE_GROUPS } from "@/lib/auth/session";
import { requireFeature } from "@/lib/billing/limits";
import { writeAuditLog } from "@/lib/db/audit";
import { rateLimitRequest } from "@/lib/security/rate-limit-async";
import { rateLimitKey } from "@/lib/security/rate-limit";
import { handleRouteError, apiError } from "@/lib/validation/api";
import { normalisePostcode, supplierKey } from "@/lib/social-value/local-spend";
import { geocodePostcodes } from "@/lib/social-value/geocode";
import { CompaniesHouseUnavailable, companyCheckOf, getCompany, isCompanyNumber } from "@/lib/geo/companies-house";

const upsertSchema = z.object({
  name: z.string().trim().min(1).max(200),
  postcode: z.string().trim().min(5).max(10).optional(),
  sme: z.boolean().nullable().optional(),
  /** Companies House number the person picked. The server reads the company itself; the client's facts are never trusted. */
  companyNumber: z.string().trim().toUpperCase().refine(isCompanyNumber).optional(),
});

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ orgId: string }> },
) {
  try {
    const { orgId } = await params;
    await requireOrgMember(orgId, ...ROLE_GROUPS.dataReaders, "contract_manager");
    const data = await prisma.svSupplierLocation.findMany({
      where: { organizationId: orgId },
      select: { id: true, name: true, postcode: true, sme: true, latitude: true, companyNumber: true, companyCheck: true },
      orderBy: { name: "asc" },
      take: 500,
    });
    return NextResponse.json({
      data: data.map(({ latitude, ...s }) => ({ ...s, located: latitude !== null })),
    });
  } catch (err) {
    return handleRouteError(err);
  }
}

/** Adds a supplier's base, or updates it when the same supplier name is saved again. */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ orgId: string }> },
) {
  try {
    const { orgId } = await params;
    const { session } = await requireOrgMember(
      orgId,
      "admin", "sustainability_director", "sustainability_manager", "contract_manager",
    );
    const planGate = await requireFeature(orgId, "socialValue");
    if (planGate) return planGate;
    const limited = await rateLimitRequest(req, {
      key: rateLimitKey(orgId, "sv-supplier-location", session.user.id),
      limit: 60,
      windowMs: 60_000,
    });
    if (limited) return limited;

    const body = upsertSchema.parse(await req.json());
    const nameKey = supplierKey(body.name);
    if (!nameKey) return apiError("VALIDATION_ERROR", "Give the supplier a name.", 400);

    // A picked company is read again here, so its postcode and register facts come from the register, not the browser.
    let company = null;
    if (body.companyNumber) {
      try {
        company = await getCompany(body.companyNumber);
      } catch (err) {
        if (!(err instanceof CompaniesHouseUnavailable)) throw err;
      }
      if (!company && !body.postcode) return apiError("UNPROCESSABLE", "Company lookup is unavailable. Type the postcode instead.", 422);
    }
    const postcode = normalisePostcode(body.postcode ?? company?.postcode ?? "");
    if (!postcode) return apiError("VALIDATION_ERROR", "That is not a UK postcode.", 400);

    let point = null;
    try {
      point = (await geocodePostcodes([postcode])).get(postcode) ?? null;
    } catch {
      return apiError("UNPROCESSABLE", "The postcode lookup is unavailable. Try again shortly.", 422);
    }
    if (!point) return apiError("VALIDATION_ERROR", `${postcode} was not found.`, 400);

    const data = {
      name: body.name,
      postcode,
      latitude: new Decimal(point.latitude),
      longitude: new Decimal(point.longitude),
      ...(body.sme !== undefined && { sme: body.sme }),
      ...(company && { companyNumber: company.number, companyCheck: companyCheckOf(company) }),
    };
    // The company number is the supplier's identity: the same company saved under another spelling joins its row.
    const byNumber = company ? await prisma.svSupplierLocation.findFirst({ where: { organizationId: orgId, companyNumber: company.number }, select: { id: true, nameKey: true, aliasKeys: true } }) : null;
    const select = { id: true, name: true, postcode: true, sme: true } as const;
    const supplier = byNumber && byNumber.nameKey !== nameKey
      ? await prisma.svSupplierLocation.update({ where: { id: byNumber.id }, data: { ...data, name: undefined, aliasKeys: [...new Set([...byNumber.aliasKeys, nameKey])] }, select })
      : await prisma.svSupplierLocation.upsert({ where: { organizationId_nameKey: { organizationId: orgId, nameKey } }, create: { organizationId: orgId, nameKey, ...data }, update: data, select });

    await writeAuditLog({
      organizationId: orgId,
      actorUserId: session.user.id,
      action: "sv_supplier_location.save",
      resourceType: "SvSupplierLocation",
      resourceId: supplier.id,
      metadata: { name: supplier.name },
    });
    return NextResponse.json(supplier, { status: 201 });
  } catch (err) {
    return handleRouteError(err);
  }
}
