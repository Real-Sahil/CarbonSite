export const dynamic = "force-dynamic";

import { AuthError, requireOrgMember } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { redirect } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { FileText } from "lucide-react";
import type { OrgRole } from "@prisma/client";
import { CreateRecordForm } from "./record-form";
import { BulkRecordActions } from "./bulk-record-actions";
import { RecordsTable } from "./records-table";

interface RecordsPageProps {
  params: Promise<{ orgId: string }>;
}

export default async function RecordsPage({ params }: RecordsPageProps) {
  const { orgId } = await params;

  let role: OrgRole;
  try {
    const result = await requireOrgMember(orgId, "admin", "editor", "reviewer", "viewer", "auditor");
    role = result.membership.role;
  } catch (err) {
    if (err instanceof AuthError) {
      if (err.status === 401) redirect("/sign-in");
      return <AccessDenied label="activity records" />;
    }
    return (
      <div className="p-8">
        <p className="text-red-600 text-sm">
          Failed to load page. The database may be updating — try refreshing in a moment.
        </p>
      </div>
    );
  }

  const canCreateRecords = role === "admin" || role === "editor";
  const canManageRecords = canCreateRecords || role === "reviewer";

  const dbResult = await Promise.all([
    prisma.reportingPeriod.findMany({
      where: { organizationId: orgId },
      select: { id: true, label: true },
      orderBy: [{ startDate: "desc" }, { createdAt: "desc" }],
    }),
    prisma.emissionCategory.findMany({
      select: { id: true, scope: true, name: true },
      orderBy: [{ scope: "asc" }, { name: "asc" }],
    }),
    prisma.facility.findMany({
      where: { organizationId: orgId },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.businessUnit.findMany({
      where: { organizationId: orgId },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.activityRecord.groupBy({
      by: ["reportingPeriodId"],
      where: { organizationId: orgId, reviewStatus: "draft" },
      _count: { _all: true },
      orderBy: { reportingPeriodId: "asc" },
    }),
    prisma.activityRecord.count({ where: { organizationId: orgId } }),
    prisma.activityRecord.count({ where: { organizationId: orgId, reviewStatus: "approved" } }),
    prisma.activityRecord.count({ where: { organizationId: orgId, reviewStatus: "draft" } }),
  ]).catch(() => null);

  if (!dbResult) {
    return (
      <div className="p-8"><p className="text-red-600 text-sm">Failed to load records. The database may be updating — try refreshing in a moment.</p></div>
    );
  }
  const [periods, categories, facilities, businessUnits, draftGroups, totalCount, approvedCount, draftCount] = dbResult;
  const periodLabelById = new Map(periods.map((period) => [period.id, period.label]));

  return (
    <div className="min-h-[100dvh] bg-[#F9FAFB]">
      {/* Page header */}
      <div className="bg-white border-b border-[#E5E7EB]">
        <div className="max-w-[1200px] mx-auto px-8 py-8">
          <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#F0F9FF]">
                  <FileText className="h-4 w-4 text-[#111827]" />
                </div>
                <span className="text-xs font-medium tracking-wide text-[#111827] uppercase">
                  Data
                </span>
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-[#111827]">
                Activity records
              </h1>
              <p className="mt-1 text-sm text-[#374151] max-w-[65ch]">
                Committed emissions activity data scoped to this organisation.
              </p>
            </div>
          </div>

          {totalCount > 0 && (
            <div className="flex flex-wrap gap-3 mt-6">
              <StatPill label="Total records" value={totalCount} />
              <StatPill label="Approved" value={approvedCount} accent="green" />
              {draftCount > 0 && (
                <StatPill label="Draft" value={draftCount} accent="amber" />
              )}
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="max-w-[1200px] mx-auto px-8 py-8 flex flex-col gap-6">
        {canManageRecords && (
          <BulkRecordActions
            orgId={orgId}
            draftGroups={draftGroups.map((group) => ({
              reportingPeriodId: group.reportingPeriodId,
              periodLabel: periodLabelById.get(group.reportingPeriodId) ?? "Unknown period",
              count: group._count._all,
            }))}
          />
        )}

        {canCreateRecords && (
          <Card className="border-[#E5E7EB] shadow-none">
            <CardHeader className="px-6 py-4 border-b border-[#E5E7EB]">
              <CardTitle className="text-sm font-semibold text-[#111827]">Add a record</CardTitle>
              <CardDescription className="text-xs text-[#9CA3AF] mt-0.5">
                Manually create an activity record with unit, period, and category.
              </CardDescription>
            </CardHeader>
            <CardContent className="px-6 py-5">
              <CreateRecordForm
                orgId={orgId}
                periods={periods}
                categories={categories.map((category) => ({
                  id: category.id,
                  scope: category.scope,
                  label: category.name,
                }))}
                facilities={facilities.map((facility) => ({
                  id: facility.id,
                  label: facility.name,
                }))}
                businessUnits={businessUnits.map((businessUnit) => ({
                  id: businessUnit.id,
                  label: businessUnit.name,
                }))}
              />
            </CardContent>
          </Card>
        )}

        <Card className="border-[#E5E7EB] shadow-none">
          <CardHeader className="px-6 py-4 border-b border-[#E5E7EB]">
            <CardTitle className="text-sm font-semibold text-[#111827]">
              Records
              {totalCount > 0 && (
                <span className="ml-2 text-xs font-normal text-[#9CA3AF]">({totalCount.toLocaleString("en-GB")})</span>
              )}
            </CardTitle>
            <CardDescription className="text-xs text-[#9CA3AF] mt-0.5">
              Records are created from imports, manual entry, or approved field submissions.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <RecordsTable orgId={orgId} canManageRecords={canManageRecords} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}


function AccessDenied({ label }: { label: string }) {
  return (
    <div className="p-8">
      <p className="text-sm text-red-600">You do not have permission to view {label}.</p>
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
    green: "bg-[#F0F9FF] text-[#111827]",
    amber: "bg-amber-50 text-amber-700",
    red: "bg-red-50 text-red-700",
  };
  const base = accent ? colors[accent] : "bg-white text-[#374151] border border-[#E5E7EB]";
  return (
    <div className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${base}`}>
      <span className="tabular-nums font-semibold">{value}</span>
      <span>{label}</span>
    </div>
  );
}
