import { companyFlags, getCompany, isCompanyNumber, type CompanyFlag } from "@/lib/geo/companies-house";
import type { RegisterResult } from "@/lib/waste/carrier-register";

export type CarrierCompany = { number: string; status: string | null; flags: CompanyFlag[] };

/**
 * A registered carrier is a company; add what Companies House says about it (active, in liquidation, dissolved,
 * overdue accounts). The register already gave the company number, so only that number is sent. A failed or
 * missing lookup leaves the register result as it was: it never fails a check and never counts as a problem.
 */
export async function withCompanyStatus<T extends RegisterResult>(result: T): Promise<T & { company?: CarrierCompany }> {
  const number = "companyNumber" in result ? (result.companyNumber ?? "").toUpperCase().padStart(8, "0") : "";
  if (!isCompanyNumber(number)) return result;
  try {
    const c = await getCompany(number);
    return c ? { ...result, company: { number: c.number, status: c.status, flags: companyFlags(c) } } : result;
  } catch {
    return result;
  }
}
