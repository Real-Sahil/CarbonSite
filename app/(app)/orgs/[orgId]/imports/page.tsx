export const dynamic = "force-dynamic";

import { AuthError, requireOrgMember, ROLE_GROUPS } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Upload } from "lucide-react";
import { CreateImportForm } from "./import-form";
import { ImportsTable } from "./imports-table";

interface ImportsPageProps {
  params: Promise<{ orgId: string }>;
}

export default async function ImportsPage({ params }: ImportsPageProps) {
  const { orgId } = await params;

  let isAdminOrEditor = false;
  try {
    const { membership } = await requireOrgMember(orgId, ...ROLE_GROUPS.dataReaders);
    // Same roles the import API accepts, so sustainability leads see the actions too.
    isAdminOrEditor = ROLE_GROUPS.editor.includes(membership.role);
  } catch (err) {
    if (err instanceof AuthError) {
      if (err.status === 401) redirect("/sign-in");
      return (
        <div className="p-8 text-sm text-[#5B6A78]">
          You do not have permission to view imports.
        </div>
      );
    }
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[imports] auth/membership check failed:", msg);
    return (
      <div className="p-8">
        <p className="text-sm font-medium text-red-700">Failed to load imports (auth/db error)</p>
        <pre className="mt-2 text-xs text-red-600 whitespace-pre-wrap break-all max-w-2xl">{msg}</pre>
      </div>
    );
  }

  let allPeriods: { id: string; label: string }[] = [];
  let profiles: { id: string; name: string }[] = [];
  let sites: { id: string; label: string }[] = [];
  let allPeriodLabels: Record<string, string> = {};
  const importStats: { total: number; committed: number; attention: number } = {
    total: 0,
    committed: 0,
    attention: 0,
  };

  try {
    const [periodsResult, batchCounts, profileRows, siteRows] = await Promise.all([
      prisma.reportingPeriod.findMany({
        where: { organizationId: orgId },
        select: { id: true, label: true },
        orderBy: [{ startDate: "desc" }, { createdAt: "desc" }],
      }),
      prisma.importBatch.groupBy({
        by: ["state"],
        where: { organizationId: orgId },
        _count: { _all: true },
      }),
      prisma.importProfile.findMany({
        where: { organizationId: orgId },
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      }),
      prisma.site.findMany({
        where: { organizationId: orgId },
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      }),
    ]);
    sites = siteRows.map((site) => ({ id: site.id, label: site.name }));
    allPeriods = periodsResult;
    profiles = profileRows;
    allPeriodLabels = Object.fromEntries(periodsResult.map((p) => [p.id, p.label]));
    for (const row of batchCounts) {
      importStats.total += row._count._all;
      if (row.state === "committed") importStats.committed += row._count._all;
      if (row.state === "needs_attention" || row.state === "failed") importStats.attention += row._count._all;
    }
  } catch (dbErr) {
    const msg = dbErr instanceof Error ? dbErr.message : String(dbErr);
    console.error("[imports] db query failed:", msg);
    return (
      <div className="p-8">
        <p className="text-sm font-medium text-red-700">Failed to load imports</p>
        <pre className="mt-2 text-xs text-red-600 whitespace-pre-wrap break-all max-w-2xl">{msg}</pre>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-[#F9FAFC]">
      {/* Page header */}
      <div className="bg-white border-b border-[#E3E8EE]">
        <div className="max-w-[1200px] mx-auto px-4 sm:px-8 py-8">
          <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#FFF7ED]">
                  <Upload className="h-4 w-4 text-[#131d29]" />
                </div>
                <span className="text-xs font-medium tracking-wide text-[#131d29] uppercase">
                  Data intake
                </span>
              </div>
              <h1 className="text-2xl tracking-tight text-[#131d29]">
                Imports
              </h1>
              <p className="mt-1 text-sm text-[#5B6A78] max-w-[65ch]">
                Upload, validate, and commit activity data. CSV and XLSX templates accepted up to 50 MB.
              </p>
              {isAdminOrEditor ? (
                <p className="mt-2 text-sm">
                  <Link href={`/orgs/${orgId}/imports/from-accounting`} className="font-medium text-[#131d29] underline underline-offset-4">
                    Stage lines from your accounting system
                  </Link>
                </p>
              ) : null}
            </div>
          </div>

          {importStats.total > 0 && (
            <div className="flex flex-wrap gap-3 mt-6">
              <StatPill label="Total batches" value={importStats.total} />
              <StatPill label="Committed" value={importStats.committed} accent="green" />
              {importStats.attention > 0 && (
                <StatPill label="Need attention" value={importStats.attention} accent="amber" />
              )}
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="max-w-[1200px] mx-auto px-4 sm:px-8 py-8 flex flex-col gap-6">
        {/* Upload card */}
        <Card className="border-[#E3E8EE] shadow-none">
          <CardHeader className="px-6 py-4 border-b border-[#E3E8EE]">
            <CardTitle className="text-sm font-semibold text-[#131d29]">Upload a file</CardTitle>
            <CardDescription className="text-xs text-[#5B6A78] mt-0.5">
              Select a reporting period and how to read the file. A saved ERP export profile reads your finance system&apos;s ledger export as it is.
            </CardDescription>
          </CardHeader>
          <CardContent className="px-6 py-5">
            <CreateImportForm orgId={orgId} periods={allPeriods} profiles={profiles} />

          </CardContent>
        </Card>

        {/* Batches table */}
        <Card className="border-[#E3E8EE] shadow-none">
            <CardHeader className="px-6 py-4 border-b border-[#E3E8EE]">
              <CardTitle className="text-sm font-semibold text-[#131d29]">
                Import batches
                {importStats.total > 0 && (
                  <span className="ml-2 text-xs font-normal text-[#5B6A78]">({importStats.total.toLocaleString("en-GB")})</span>
                )}
              </CardTitle>
              <CardDescription className="text-xs text-[#5B6A78] mt-0.5">
                Source files and validation exports stored using organisation-scoped keys.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <ImportsTable
                orgId={orgId}
                isAdminOrEditor={isAdminOrEditor}
                periodLabelById={allPeriodLabels}
                sites={sites}
              />
            </CardContent>
          </Card>
      </div>
    </div>
  );
}

function StatPill({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent?: "green" | "amber" | "red";
}) {
  const colors = {
    green: "bg-[#FFF7ED] text-[#131d29]",
    amber: "bg-amber-50 text-amber-700",
    red: "bg-red-50 text-red-700",
  };
  const base = accent ? colors[accent] : "bg-white text-[#41505F] border border-[#E3E8EE]";
  return (
    <div className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${base}`}>
      <span className="tabular-nums font-semibold">{value}</span>
      <span>{label}</span>
    </div>
  );
}

