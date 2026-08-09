import { AuthError, requireOrgMember } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { redirect } from "next/navigation";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { FileText } from "lucide-react";
import type { OrgRole } from "@prisma/client";
import { CreateRecordForm } from "./record-form";
import { RecordActions } from "./record-actions";
import { RecordEvidenceActions } from "./record-evidence-actions";
import { BulkRecordActions } from "./bulk-record-actions";

interface RecordsPageProps {
  params: Promise<{ orgId: string }>;
}

const REVIEW_LABELS: Record<string, string> = {
  draft: "Draft",
  in_review: "In review",
  approved: "Approved",
  rejected: "Rejected",
};

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
    throw err;
  }

  const canCreateRecords = role === "admin" || role === "editor";
  const canManageRecords = canCreateRecords || role === "reviewer";
  const [records, periods, categories, facilities, businessUnits, draftGroups] = await Promise.all([
    prisma.activityRecord.findMany({
      where: { organizationId: orgId },
      include: {
        reportingPeriod: { select: { label: true } },
        emissionCategory: { select: { scope: true, name: true, code: true } },
        facility: { select: { name: true } },
        businessUnit: { select: { name: true } },
        evidence: {
          include: {
            evidenceFile: { select: { id: true, filename: true } },
          },
        },
        _count: { select: { calculations: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
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
  ]);

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

          {records.length > 0 && (
            <div className="flex flex-wrap gap-3 mt-6">
              <StatPill label="Total records" value={records.length} />
              <StatPill
                label="Approved"
                value={records.filter((r) => r.reviewStatus === "approved").length}
                accent="green"
              />
              {records.filter((r) => r.reviewStatus === "draft").length > 0 && (
                <StatPill
                  label="Draft"
                  value={records.filter((r) => r.reviewStatus === "draft").length}
                  accent="amber"
                />
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
              <span className="ml-2 text-xs font-normal text-[#9CA3AF]">({records.length})</span>
            </CardTitle>
            <CardDescription className="text-xs text-[#9CA3AF] mt-0.5">
              Records are created from imports, manual entry, or approved field submissions.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {records.length === 0 ? (
              <EmptyState
                icon={FileText}
                title="No activity records yet"
                description="Import activity data or approve field submissions to create auditable records."
              />
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-[#F9FAFB] border-b border-[#E5E7EB]">
                      <TableHead className="text-xs font-medium text-[#9CA3AF] py-3 pl-6">Source</TableHead>
                      <TableHead className="text-xs font-medium text-[#9CA3AF] py-3">Category</TableHead>
                      <TableHead className="text-xs font-medium text-[#9CA3AF] py-3">Amount</TableHead>
                      <TableHead className="text-xs font-medium text-[#9CA3AF] py-3">Period</TableHead>
                      <TableHead className="text-xs font-medium text-[#9CA3AF] py-3">Location</TableHead>
                      <TableHead className="text-xs font-medium text-[#9CA3AF] py-3">Distance</TableHead>
                      <TableHead className="text-xs font-medium text-[#9CA3AF] py-3">Evidence</TableHead>
                      <TableHead className="text-xs font-medium text-[#9CA3AF] py-3">Status</TableHead>
                      {canManageRecords && <TableHead className="text-xs font-medium text-[#9CA3AF] py-3 pr-6">Actions</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {records.map((record) => (
                      <TableRow key={record.id} className="border-b border-[#F3F4F6] hover:bg-[#F9FAFB] transition-colors">
                        <TableCell className="py-3.5 pl-6">
                          <Link
                            href={`/orgs/${orgId}/records/${record.id}`}
                            className="font-medium text-sm text-[#111827] hover:underline underline-offset-2"
                          >
                            {record.sourceDescription ?? record.supplierName ?? "Activity record"}
                          </Link>
                        </TableCell>
                        <TableCell className="py-3.5">
                          <div className="text-sm font-medium text-[#111827]">
                            Scope {record.emissionCategory.scope}
                          </div>
                          <div className="text-xs text-[#9CA3AF]">
                            {record.emissionCategory.name}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-[#374151] py-3.5 tabular-nums">
                          {Number(record.amount).toLocaleString("en-GB")} {record.unit}
                        </TableCell>
                        <TableCell className="text-sm text-[#374151] py-3.5">
                          {record.reportingPeriod.label}
                        </TableCell>
                        <TableCell className="text-sm text-[#374151] py-3.5">
                          {record.facility?.name ?? record.businessUnit?.name ?? record.country ?? "Not assigned"}
                        </TableCell>
                        <TableCell className="text-sm text-[#374151] py-3.5 tabular-nums">
                          {record.distanceAmount
                            ? `${Number(record.distanceAmount).toLocaleString("en-GB", {
                                maximumFractionDigits: 2,
                              })} ${record.distanceUnit ?? "km"}`
                            : "Not set"}
                        </TableCell>
                        <TableCell className="py-3.5">
                          <RecordEvidenceActions
                            orgId={orgId}
                            recordId={record.id}
                            files={record.evidence.map((item) => ({
                              id: item.evidenceFile.id,
                              filename: item.evidenceFile.filename,
                            }))}
                            canManage={canManageRecords}
                          />
                          <div className="text-xs text-[#9CA3AF]">
                            {record.evidenceStatus.replaceAll("_", " ")}
                          </div>
                        </TableCell>
                        <TableCell className="py-3.5">
                          <Badge variant={record.reviewStatus === "approved" ? "default" : "outline"}>
                            {REVIEW_LABELS[record.reviewStatus] ?? record.reviewStatus}
                          </Badge>
                        </TableCell>
                        {canManageRecords && (
                          <TableCell className="py-3.5 pr-6">
                            <RecordActions
                              orgId={orgId}
                              recordId={record.id}
                              label={record.sourceDescription ?? record.supplierName ?? record.id}
                              reviewStatus={record.reviewStatus}
                              evidenceStatus={record.evidenceStatus}
                              canDelete={record._count.calculations === 0}
                            />
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
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

function EmptyState({
  icon: Icon,
  title,
  description,
}: {
  icon: React.ElementType;
  title: string;
  description: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#F0F9FF] mb-5">
        <Icon className="h-7 w-7 text-[#111827]" />
      </div>
      <p className="text-base font-semibold text-[#111827] mb-2">{title}</p>
      <p className="text-sm text-[#374151] max-w-sm">{description}</p>
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
