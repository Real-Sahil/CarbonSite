export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import type { OrgRole } from "@prisma/client";
import { AuthError, requireOrgMember } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { DEFAULT_RADIUS_MILES, MAX_RADIUS_MILES } from "@/lib/social-value/local-spend";
import { loadLocalSpend } from "@/lib/social-value/local-spend-load";
import { RemoveSupplierButton, SupplierForm } from "./supplier-form";

interface Props {
  params: Promise<{ orgId: string }>;
  searchParams: Promise<{ siteId?: string; radius?: string }>;
}

const VIEW_ROLES: OrgRole[] = [
  "admin", "sustainability_director", "sustainability_manager", "contract_manager",
  "editor", "reviewer", "viewer", "auditor",
];
const EDIT_ROLES: OrgRole[] = ["admin", "sustainability_director", "sustainability_manager", "contract_manager"];

const gbp = (n: number) => `£${n.toLocaleString("en-GB", { maximumFractionDigits: 0 })}`;
const pct = (n: number | null) => (n === null ? "No placed spend" : `${n}%`);

export default async function LocalSpendPage({ params, searchParams }: Props) {
  const { orgId } = await params;
  const { siteId, radius } = await searchParams;

  let role: OrgRole;
  try {
    role = (await requireOrgMember(orgId, ...VIEW_ROLES)).membership.role;
  } catch (err) {
    if (err instanceof AuthError) {
      if (err.status === 401) redirect("/sign-in");
      return <p className="p-6 text-sm">You do not have access to this page.</p>;
    }
    throw err;
  }
  const canEdit = EDIT_ROLES.includes(role);
  const radiusMiles = Math.min(Math.max(Number(radius) || DEFAULT_RADIUS_MILES, 1), MAX_RADIUS_MILES);

  const [sites, suppliers] = await Promise.all([
    prisma.site.findMany({
      where: { organizationId: orgId },
      select: { id: true, name: true, postcode: true },
      orderBy: { name: "asc" },
      take: 200,
    }),
    prisma.svSupplierLocation.findMany({
      where: { organizationId: orgId },
      select: { id: true, name: true, postcode: true, sme: true },
      orderBy: { name: "asc" },
      take: 500,
    }),
  ]);
  const result = siteId ? await loadLocalSpend(orgId, { siteId, radiusMiles }) : null;

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <header>
        <h1 className="text-xl font-semibold">Local spend</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Share of a site&apos;s supplier spend that went to businesses within a set distance, and to SMEs. Distances are
          straight-line from the site&apos;s postcode. Counts GBP spend on reviewed and approved records that name a supplier you have placed below.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Site</CardTitle>
          <CardDescription>Pick a site to see its figures.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="flex flex-wrap items-end gap-3" method="get">
            <label className="grid gap-1.5 text-sm">
              Site
              <select name="siteId" defaultValue={siteId ?? ""} required className="h-9 min-w-56 rounded-md border border-input bg-background px-2 text-sm">
                <option value="" disabled>Choose a site</option>
                {sites.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}{s.postcode ? ` (${s.postcode})` : ""}</option>
                ))}
              </select>
            </label>
            <label className="grid gap-1.5 text-sm">
              Miles
              <input name="radius" type="number" min={1} max={MAX_RADIUS_MILES} defaultValue={radiusMiles} className="h-9 w-24 rounded-md border border-input bg-background px-2 text-sm" />
            </label>
            <button type="submit" className="h-9 rounded-md bg-foreground px-4 text-sm text-background">Show</button>
          </form>

          {result && !result.ok && <p role="alert" className="mt-4 text-sm text-red-700">{result.message}</p>}

          {result?.ok && (
            <div className="mt-6 space-y-5">
              <dl className="grid gap-4 sm:grid-cols-3">
                <div>
                  <dt className="text-sm text-muted-foreground">Within {result.summary.radiusMiles} miles of {result.site.name}</dt>
                  <dd className="text-2xl font-semibold tabular-nums">{pct(result.summary.localPct)}</dd>
                  <dd className="text-sm text-muted-foreground tabular-nums">{gbp(result.summary.localGbp)} of {gbp(result.summary.totalGbp)}</dd>
                </div>
                <div>
                  <dt className="text-sm text-muted-foreground">With SMEs</dt>
                  <dd className="text-2xl font-semibold tabular-nums">{pct(result.summary.smePct)}</dd>
                  <dd className="text-sm text-muted-foreground tabular-nums">{gbp(result.summary.smeGbp)}</dd>
                </div>
                <div>
                  <dt className="text-sm text-muted-foreground">Local and SME</dt>
                  <dd className="text-2xl font-semibold tabular-nums">{gbp(result.summary.localSmeGbp)}</dd>
                </div>
              </dl>

              <p className="text-sm text-muted-foreground">
                Not in the share: {gbp(result.summary.unplaced.unlocatedGbp)} to suppliers with no postcode saved,{" "}
                {gbp(result.summary.unplaced.noSupplierGbp)} on records with no supplier name
                {result.summary.unplaced.notGbpLines > 0 ? `, and ${result.summary.unplaced.notGbpLines} lines not in GBP` : ""}.
                Based on {result.recordCount} records.
              </p>

              {result.summary.missingLocations.length > 0 && (
                <div>
                  <h2 className="text-sm font-medium">Add a postcode for these suppliers</h2>
                  <ul className="mt-2 grid gap-1 text-sm">
                    {result.summary.missingLocations.map((m) => (
                      <li key={m.name} className="flex justify-between gap-4"><span>{m.name}</span><span className="tabular-nums">{gbp(m.spendGbp)}</span></li>
                    ))}
                  </ul>
                </div>
              )}

              {result.summary.topLocal.length > 0 && (
                <div>
                  <h2 className="text-sm font-medium">Largest local suppliers</h2>
                  <Table>
                    <TableHeader>
                      <TableRow><TableHead>Supplier</TableHead><TableHead className="text-right">Miles</TableHead><TableHead className="text-right">Spend</TableHead></TableRow>
                    </TableHeader>
                    <TableBody>
                      {result.summary.topLocal.map((s) => (
                        <TableRow key={s.name}><TableCell>{s.name}</TableCell><TableCell className="text-right tabular-nums">{s.miles}</TableCell><TableCell className="text-right tabular-nums">{gbp(s.spendGbp)}</TableCell></TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Supplier locations</CardTitle>
          <CardDescription>Where each supplier is based. Names match your records however they are written (Ltd, &amp; and case are ignored).</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {canEdit && <SupplierForm orgId={orgId} />}
          {suppliers.length === 0 ? (
            <p className="text-sm text-muted-foreground">No suppliers placed yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow><TableHead>Supplier</TableHead><TableHead>Postcode</TableHead><TableHead>SME</TableHead>{canEdit && <TableHead className="w-24"><span className="sr-only">Actions</span></TableHead>}</TableRow>
              </TableHeader>
              <TableBody>
                {suppliers.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell>{s.name}</TableCell>
                    <TableCell>{s.postcode}</TableCell>
                    <TableCell>{s.sme === null ? <Badge variant="outline">Not known</Badge> : s.sme ? "Yes" : "No"}</TableCell>
                    {canEdit && <TableCell><RemoveSupplierButton orgId={orgId} supplierId={s.id} name={s.name} /></TableCell>}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
