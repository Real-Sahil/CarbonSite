export const dynamic = "force-dynamic";

import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AuthError, ROLE_GROUPS, requireOrgMember } from "@/lib/auth/session";
import { getOrgBasics } from "@/lib/i18n/org-basics";
import { formatters, orgFormat } from "@/lib/i18n/org-format";
import type { AccountCarbonRow } from "@/lib/ledger/account-carbon";
import { loadCarbonByAccount } from "@/lib/ledger/account-carbon-load";

interface CarbonByAccountPageProps {
  params: Promise<{ orgId: string }>;
}

export default async function CarbonByAccountPage({ params }: CarbonByAccountPageProps) {
  const { orgId } = await params;

  // Carbon by account is inventory data, so only the roles that read the inventory get it.
  try {
    await requireOrgMember(orgId, ...ROLE_GROUPS.dataReaders);
  } catch (err) {
    if (err instanceof AuthError && err.status === 401) redirect("/sign-in");
    if (err instanceof AuthError) notFound();
    throw err;
  }

  const basics = await getOrgBasics(orgId);
  const format = orgFormat(basics ?? {});
  const f = formatters(format);
  const view = await loadCarbonByAccount(orgId, format.currency);
  const importsHref = `/orgs/${orgId}/imports`;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl">Carbon by account</h1>
        <p className="text-[#41505F] mt-2">
          Headline emissions grouped by the ledger account on each approved record. Read only: nothing is written back
          to Xero or any other ledger.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Ledger accounts</CardTitle>
          <CardDescription>
            {view.accounts.length > 0
              ? `${f.number(view.accounts.length, 0)} ${view.accounts.length === 1 ? "account" : "accounts"}, ${f.tonnes(view.totalCo2eKg / 1000)} in total`
              : "Shows each ledger account once its approved records have been calculated."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {view.accounts.length === 0 && !view.unassigned ? (
            <EmptyState
              icon={BookOpen}
              title="No approved records with a ledger account yet"
              description="Each record takes its ledger account from the account column of an ERP import profile, or from a column named ledgerAccount (or a GL or nominal alias) in a plain import."
            >
              <Button asChild variant="outline">
                <Link href={importsHref}>Go to imports</Link>
              </Button>
            </EmptyState>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Ledger account</TableHead>
                    <TableHead>Records</TableHead>
                    <TableHead>Not calculated</TableHead>
                    <TableHead>Headline tCO2e</TableHead>
                    <TableHead>Spend, nominal ({format.currency})</TableHead>
                    <TableHead>kg CO2e per unit of spend</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {view.accounts.map((row) => (
                    <AccountRow key={row.account ?? ""} label={row.account ?? ""} row={row} f={f} currency={format.currency} />
                  ))}
                  {view.unassigned && (
                    <AccountRow
                      label="No ledger account"
                      row={view.unassigned}
                      f={f}
                      currency={format.currency}
                    />
                  )}
                </TableBody>
              </Table>
              <p className="text-sm text-[#41505F]">
                Figures are headline only, as on the dashboard: approved records, every period, market-based Scope 2
                left out. Each record uses its latest calculation. Spend counts only records in {format.currency} (a blank
                currency counts as {format.currency}). Records in another currency are counted but not converted, so they
                are left out of spend and intensity. Intensity is kg CO2e per unit of spend, over the records that have
                both. Account codes match exactly once spaces at the ends are trimmed, so 4000 and 4000A are separate
                accounts. Records with no ledger account are listed as unassigned, so the total still matches the headline.
              </p>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

type Formatters = ReturnType<typeof formatters>;

function AccountRow({
  label,
  row,
  f,
  currency,
}: {
  label: string;
  row: AccountCarbonRow;
  f: Formatters;
  currency: string;
}) {
  return (
    <TableRow>
      <TableCell className="font-medium">{label}</TableCell>
      <TableCell>{f.number(row.recordCount, 0)}</TableCell>
      <TableCell>{row.uncalculatedRecordCount > 0 ? f.number(row.uncalculatedRecordCount, 0) : "-"}</TableCell>
      <TableCell>{f.tonnes(row.co2eKg / 1000)}</TableCell>
      <TableCell>
        {row.spendRecordCount > 0 ? f.money(row.spendAmount, currency) : "-"}
        {row.otherCurrencyRecordCount > 0 && (
          <span className="text-[#41505F]"> ({f.number(row.otherCurrencyRecordCount, 0)} not converted)</span>
        )}
      </TableCell>
      <TableCell>{row.kgPerUnitSpend === null ? "-" : f.number(row.kgPerUnitSpend, 2, 2)}</TableCell>
    </TableRow>
  );
}
