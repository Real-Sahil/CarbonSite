import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError } from "@/lib/validation/api";
import { COMPANIES_HOUSE_ATTRIBUTION, CompaniesHouseUnavailable, companyFlags, getCompany, getCorporateOwners, isCompanyNumber, searchCompanies, smeHint } from "@/lib/geo/companies-house";

const query = z.union([
  z.object({ q: z.string().trim().min(3).max(120) }),
  z.object({ number: z.string().trim().toUpperCase().refine(isCompanyNumber, "A Companies House number has 8 characters"), owners: z.enum(["1"]).optional() }),
]);

/**
 * The one reply for both company routes (the organisation's and the sign-up one): a name search gives candidates to
 * choose from, a number gives that company with its flags and SME hint (and, with owners=1, the companies that control it).
 */
export async function companiesReply(params: URLSearchParams): Promise<NextResponse> {
  try {
    const p = query.parse(Object.fromEntries(params));
    if ("q" in p) return NextResponse.json({ candidates: await searchCompanies(p.q), attribution: COMPANIES_HOUSE_ATTRIBUTION });
    const company = await getCompany(p.number);
    if (!company) return apiError("NOT_FOUND", "No company with that number.", 404);
    const owners = p.owners ? await getCorporateOwners(p.number).catch(() => []) : undefined;
    return NextResponse.json({ company, flags: companyFlags(company), smeHint: smeHint(company.accountsType), ...(owners && { owners }), attribution: COMPANIES_HOUSE_ATTRIBUTION });
  } catch (err) {
    if (err instanceof CompaniesHouseUnavailable) {
      console.warn(`[companies-house] ${err.reason} ${err.detail ?? ""}`);
      return apiError("LOOKUP_UNAVAILABLE", "Company lookup is not available. Type the details instead.", 503, { reason: err.reason, ...(err.detail && { detail: err.detail }) });
    }
    throw err;
  }
}
