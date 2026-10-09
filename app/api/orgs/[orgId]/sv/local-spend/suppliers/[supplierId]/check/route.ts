export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireOrgMember } from "@/lib/auth/session";
import { rateLimitRequest } from "@/lib/security/rate-limit-async";
import { rateLimitKey } from "@/lib/security/rate-limit";
import { handleRouteError, apiError } from "@/lib/validation/api";
import { CompaniesHouseUnavailable, companyCheckOf, getCompany } from "@/lib/geo/companies-house";

// POST: read the supplier's Companies House record again (status, accounts, insolvency) and keep it with the supplier.
// Only the company number leaves the server. A supplier saved without a picked company has nothing to check.
export async function POST(req: NextRequest, { params }: { params: Promise<{ orgId: string; supplierId: string }> }) {
  try {
    const { orgId, supplierId } = await params;
    const { session } = await requireOrgMember(orgId, "admin", "sustainability_director", "sustainability_manager", "contract_manager");
    const limited = await rateLimitRequest(req, { key: rateLimitKey(orgId, "companies-lookup", session.user.id), limit: 30, windowMs: 60_000 });
    if (limited) return limited;
    const supplier = await prisma.svSupplierLocation.findFirst({ where: { id: supplierId, organizationId: orgId }, select: { id: true, companyNumber: true } });
    if (!supplier) return apiError("NOT_FOUND", "Supplier not found.", 404);
    if (!supplier.companyNumber) return apiError("NO_COMPANY", "Pick this supplier's company on Companies House first.", 422);
    let company;
    try {
      company = await getCompany(supplier.companyNumber);
    } catch (err) {
      if (err instanceof CompaniesHouseUnavailable) return apiError("LOOKUP_UNAVAILABLE", "Company lookup is not available. Try again shortly.", 503, { reason: err.reason });
      throw err;
    }
    if (!company) return apiError("NOT_FOUND", "That company is no longer on the register.", 404);
    const companyCheck = companyCheckOf(company);
    await prisma.svSupplierLocation.updateMany({ where: { id: supplierId, organizationId: orgId }, data: { companyCheck } });
    return NextResponse.json({ companyCheck });
  } catch (err) {
    return handleRouteError(err);
  }
}
