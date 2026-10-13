import Link from "next/link";
import { Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { loadSupplierPriorities } from "@/lib/calculation/supplier-priorities-load";
import { prisma } from "@/lib/db";
import { formatters, orgFormat } from "@/lib/i18n/org-format";

/**
 * Suppliers ranked by spend and by headline emissions, from the latest
 * calculation of the latest period. Rendered for inventory readers only.
 */
export async function SupplierPriorityPanel({ orgId }: { orgId: string }) {
  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { hqCountry: true, reportingCurrency: true },
  });
  const format = orgFormat(org ?? {});
  const f = formatters(format);
  const view = await loadSupplierPriorities(orgId);
  const calculationsHref = `/orgs/${orgId}/calculations`;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Supplier priorities</CardTitle>
        <CardDescription>
          {view
            ? `${view.reportingPeriodLabel}, from the calculation of ${f.date(view.calculatedAt)}`
            : "Ranks suppliers by spend and by headline emissions once a calculation has run."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!view ? (
          <EmptyState
            icon={Users}
            title="No calculation to rank suppliers yet"
            description="Suppliers are ranked from the latest successful calculation of the latest reporting period."
          >
            <Button asChild variant="outline">
              <Link href={calculationsHref}>Go to calculations</Link>
            </Button>
          </EmptyState>
        ) : view.rows.length === 0 ? (
          <EmptyState
            icon={Users}
            title="No suppliers in this calculation"
            description="Records need a supplier name to be ranked. A calculation run before this list existed has no rows either, so run a new calculation."
          >
            <Button asChild variant="outline">
              <Link href={calculationsHref}>Go to calculations</Link>
            </Button>
          </EmptyState>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Supplier</TableHead>
                  <TableHead>Spend, nominal ({format.currency})</TableHead>
                  <TableHead>Spend rank</TableHead>
                  <TableHead>Headline tCO2e</TableHead>
                  <TableHead>Emissions rank</TableHead>
                  <TableHead>Records</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {view.rows.map((row) => (
                  <TableRow key={row.supplierKey}>
                    <TableCell className="font-medium">{row.supplierName}</TableCell>
                    <TableCell>
                      {row.spendRecordCount > 0 ? f.money(row.spendAmount, row.spendCurrency) : "-"}
                      {row.unconvertedSpendRecordCount > 0 && (
                        <span className="text-[#41505F]"> ({f.number(row.unconvertedSpendRecordCount, 0)} not converted)</span>
                      )}
                    </TableCell>
                    <TableCell>{row.spendRank ?? "-"}</TableCell>
                    <TableCell>{f.tonnes(row.totalCo2eKg / 1000)}</TableCell>
                    <TableCell>{row.emissionsRank ?? "-"}</TableCell>
                    <TableCell>
                      <Link
                        className="text-blue-600 hover:underline"
                        href={`/orgs/${orgId}/records?supplier=${encodeURIComponent(row.supplierName)}`}
                      >
                        {f.number(row.recordCount, 0)}
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <p className="text-sm text-[#41505F]">
              Suppliers are matched by name: capital letters, punctuation and company endings such as Ltd or Limited are
              ignored. Spellings that differ beyond that count as separate suppliers. Spend is nominal, converted to{" "}
              {format.currency} at each record&apos;s date. Records in a currency with no known rate are counted but left
              out of spend. Emissions are the location-based headline figures the dashboard shows. The Records link
              searches for the spelling shown, so check records under other spellings with the same search.
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}
