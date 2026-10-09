export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireOrgMember } from "@/lib/auth/session";
import { rateLimitRequest } from "@/lib/security/rate-limit-async";
import { rateLimitKey } from "@/lib/security/rate-limit";
import { apiError, handleRouteError } from "@/lib/validation/api";
import { COMPANIES_HOUSE_ATTRIBUTION, CompaniesHouseUnavailable, getCompany, isCompanyNumber, searchCompanies } from "@/lib/geo/companies-house";

const query = z.union([
  z.object({ q: z.string().trim().min(3).max(120) }),
  z.object({ number: z.string().trim().toUpperCase().refine(isCompanyNumber, "A Companies House number has 8 characters") }),
]);

// GET /api/orgs/[orgId]/companies?q=name  -> candidates to choose from
// GET /api/orgs/[orgId]/companies?number=00453791 -> that company's address and SIC codes
// Same people who may save a supplier's location. Never guesses between companies: the person picks.
export async function GET(req: NextRequest, { params }: { params: Promise<{ orgId: string }> }) {
  try {
    const { orgId } = await params;
    const { session } = await requireOrgMember(orgId, "admin", "sustainability_director", "sustainability_manager", "contract_manager");
    const limited = await rateLimitRequest(req, { key: rateLimitKey(orgId, "companies-lookup", session.user.id), limit: 30, windowMs: 60_000 });
    if (limited) return limited;
    const p = query.parse(Object.fromEntries(req.nextUrl.searchParams));
    if ("q" in p) return NextResponse.json({ candidates: await searchCompanies(p.q), attribution: COMPANIES_HOUSE_ATTRIBUTION });
    const company = await getCompany(p.number);
    if (!company) return apiError("NOT_FOUND", "No company with that number.", 404);
    return NextResponse.json({ company, attribution: COMPANIES_HOUSE_ATTRIBUTION });
  } catch (err) {
    if (err instanceof CompaniesHouseUnavailable) {
      console.warn(`[companies-house] ${err.reason}`);
      return apiError("LOOKUP_UNAVAILABLE", "Company lookup is not available. Type the details instead.", 503, { reason: err.reason });
    }
    return handleRouteError(err);
  }
}
