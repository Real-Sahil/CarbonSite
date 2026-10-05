// Reads the Xero invoice lines already synced for an organisation and attaches a
// suggestion to each (lib/ledger/suggest.ts). Nothing is created here; staging
// into an import batch is a separate, explicit step (stageLedgerLines below).

import { prisma } from "@/lib/db";
import { supplierKey } from "@/lib/social-value/local-spend";
import { suggestLedgerLine, STAGEABLE_CATEGORIES, type LedgerSuggestion } from "./suggest";
import type { ConnectorActivityRecord } from "@/lib/connectors/types";

export interface LedgerLineView {
  id: string;
  invoiceNumber: string;
  invoiceDate: string | null;
  supplier: string;
  description: string;
  amount: number;
  suggestion: LedgerSuggestion;
}

/** The category the organisation uses most for each supplier in its own records. */
export async function learnedSupplierCategories(orgId: string): Promise<Map<string, string>> {
  const groups = await prisma.activityRecord.groupBy({
    by: ["supplierName", "emissionCategoryId"],
    where: { organizationId: orgId, supplierName: { not: null }, reviewStatus: { in: ["approved", "in_review"] } },
    _count: { _all: true },
  });
  const categories = await prisma.emissionCategory.findMany({ select: { id: true, code: true } });
  const code = new Map(categories.map((c) => [c.id, c.code]));

  const best = new Map<string, { code: string; n: number }>();
  for (const g of groups) {
    if (!g.supplierName) continue;
    const c = code.get(g.emissionCategoryId);
    if (!c || !(STAGEABLE_CATEGORIES as readonly string[]).includes(c)) continue;
    const key = supplierKey(g.supplierName);
    const n = g._count._all;
    if (!best.has(key) || n > best.get(key)!.n) best.set(key, { code: c, n });
  }
  return new Map([...best].map(([k, v]) => [k, v.code]));
}

export async function loadLedgerLines(orgId: string, limit = 500): Promise<LedgerLineView[]> {
  const logs = await prisma.xeroSyncLog.findMany({
    where: { organizationId: orgId, status: "processed" },
    orderBy: { processedAt: "desc" },
    take: limit,
  });
  if (logs.length === 0) return [];

  const invoices = await prisma.invoiceRecord.findMany({
    where: { organizationId: orgId, sourceSystem: "xero", externalInvoiceId: { in: [...new Set(logs.map((l) => l.invoiceId))] } },
    select: { externalInvoiceId: true, invoiceDate: true },
  });
  const dates = new Map(invoices.map((i) => [i.externalInvoiceId, i.invoiceDate]));
  const learned = await learnedSupplierCategories(orgId);

  return logs.map((l) => ({
    id: l.id,
    invoiceNumber: l.invoiceNumber,
    invoiceDate: dates.get(l.invoiceId)?.toISOString().slice(0, 10) ?? null,
    supplier: l.supplierName,
    description: l.lineDescription,
    amount: Number(l.amount),
    suggestion: suggestLedgerLine({ supplier: l.supplierName, description: l.lineDescription }, learned),
  }));
}

export interface ConfirmedLine {
  id: string;
  categoryCode: string;
  industryCode?: string | null;
}

/** Spend records for the confirmed lines, in the shape the connector ingest turns into an import batch. */
export function ledgerRecords(
  lines: Array<LedgerLineView & { confirmed: ConfirmedLine }>,
  currency: string,
): Array<ConnectorActivityRecord & { industryCode?: string }> {
  return lines.map((l) => {
    const date = l.invoiceDate ? new Date(l.invoiceDate) : undefined;
    return {
      externalRecordId: l.id,
      emissionCategoryCode: l.confirmed.categoryCode,
      activityDate: date,
      amount: l.amount,
      unit: currency,
      spendAmount: l.amount,
      spendCurrency: currency,
      sourceDescription: `Xero ${l.invoiceNumber}: ${l.description}`.slice(0, 240),
      supplierName: l.supplier,
      industryCode: l.confirmed.industryCode ?? undefined,
      validationWarnings: [
        "From an accounting line, priced on spend. A quantity from the bill would be more accurate.",
        ...(l.confirmed.industryCode ? [`Suggested industry code ${l.confirmed.industryCode}; confirm it.`] : []),
      ],
    };
  });
}
