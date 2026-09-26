/**
 * Contract import from a Find a Tender notice: an award notice gives the
 * buyer, awarded value, contract dates and the winning suppliers; a tender
 * notice gives the estimate. Nothing is created until the person confirms
 * the draft on the Contracts page.
 */
import type { NoticeSummary } from "./fts";

export type ContractDraft = {
  name: string;
  clientName: string | null;
  contractReference: string | null;
  tenderReference: string | null;
  procuringAuthority: string | null;
  contractValue: number | null;
  currency: string;
  startDate: string | null;
  endDate: string | null;
  ftsNoticeId: string;
  notes: string;
};

const day = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null);
const norm = (s: string) => s.toLowerCase().replace(/\b(ltd|limited|plc|llp)\b\.?/g, "").replace(/[^a-z0-9]/g, "");

export function contractDraft(n: NoticeSummary): ContractDraft {
  return {
    name: n.title.slice(0, 200),
    clientName: n.buyerName?.slice(0, 200) ?? null,
    contractReference: n.noticeId,
    tenderReference: n.tenderReference?.slice(0, 100) ?? null,
    procuringAuthority: n.buyerName?.slice(0, 200) ?? null,
    contractValue: n.value,
    currency: (n.currency ?? "GBP").toUpperCase(),
    startDate: day(n.contractStart),
    endDate: day(n.contractEnd),
    ftsNoticeId: n.noticeId,
    notes: `Imported from Find a Tender notice ${n.noticeId}${n.stage === "award" ? " (award)" : " (tender: value is the buyer's estimate)"}.`,
  };
}

/** Warnings to show beside the draft before it is saved. */
export function draftWarnings(n: NoticeSummary, orgName: string): string[] {
  const out: string[] = [];
  if (n.stage === "tender") out.push("This is a tender notice, not an award: the value is the buyer's estimate and no supplier is named yet. Import the award notice once the contract is won.");
  if (n.stage === "award" && n.suppliers.length && !n.suppliers.some((s) => norm(s) === norm(orgName) || norm(s).includes(norm(orgName)) || norm(orgName).includes(norm(s)))) {
    out.push(`The notice names ${n.suppliers.join(", ")} as the supplier, not ${orgName}. Import it only if you deliver this contract, for example as a subcontractor.`);
  }
  if (n.value == null) out.push("The notice gives no value; add it before using the contract's carbon intensity.");
  if (!n.contractStart || !n.contractEnd) out.push("The notice gives no contract period; add the dates.");
  return out;
}
