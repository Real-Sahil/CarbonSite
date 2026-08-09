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
    <div className="p-8 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">Activity records</h1>
        <p className="text-slate-500 mt-1">
          Committed emissions activity data scoped to this organisation.
        </p>
      </div>

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

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Records <span className="text-sm font-normal text-slate-500">({records.length})</span>
          </CardTitle>
          <CardDescription>
            Records are created from imports, manual entry, or approved field submissions.
          </CardDescription>
        </CardHeader>
        <CardContent className={records.length === 0 ? "pb-8" : "p-0 pb-2"}>
          {canCreateRecords && (
            <div className="px-6 pb-5">
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
            </div>
          )}
          {records.length === 0 ? (
            <EmptyState
              icon={FileText}
              title="No activity records yet"
              description="Import activity data or approve field submissions to create auditable records."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Source</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Period</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Distance</TableHead>
                  <TableHead>Evidence</TableHead>
                  <TableHead>Status</TableHead>
                  {canManageRecords && <TableHead>Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {records.map((record) => (
                  <TableRow key={record.id}>
                    <TableCell className="font-medium">
                      <Link
                        href={`/orgs/${orgId}/records/${record.id}`}
                        className="hover:underline underline-offset-2 text-[#111827]"
                      >
                        {record.sourceDescription ?? record.supplierName ?? "Activity record"}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <div className="font-medium text-slate-900">
                        Scope {record.emissionCategory.scope}
                      </div>
                      <div className="text-xs text-slate-500">
                        {record.emissionCategory.name}
                      </div>
                    </TableCell>
                    <TableCell className="text-slate-600">
                      {Number(record.amount).toLocaleString("en-GB")} {record.unit}
                    </TableCell>
                    <TableCell className="text-slate-600">
                      {record.reportingPeriod.label}
                    </TableCell>
                    <TableCell className="text-slate-600">
                      {record.facility?.name ?? record.businessUnit?.name ?? record.country ?? "Not assigned"}
                    </TableCell>
                    <TableCell className="text-slate-600">
                      {record.distanceAmount
                        ? `${Number(record.distanceAmount).toLocaleString("en-GB", {
                            maximumFractionDigits: 2,
                          })} ${record.distanceUnit ?? "km"}`
                        : "Not set"}
                    </TableCell>
                    <TableCell className="text-slate-600">
                      <RecordEvidenceActions
                        orgId={orgId}
                        recordId={record.id}
                        files={record.evidence.map((item) => ({
                          id: item.evidenceFile.id,
                          filename: item.evidenceFile.filename,
                        }))}
                        canManage={canManageRecords}
                      />
                      <div className="text-xs text-slate-500">
                        {record.evidenceStatus.replaceAll("_", " ")}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={record.reviewStatus === "approved" ? "default" : "outline"}>
                        {REVIEW_LABELS[record.reviewStatus] ?? record.reviewStatus}
                      </Badge>
                    </TableCell>
                    {canManageRecords && (
                      <TableCell>
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
          )}
        </CardContent>
      </Card>
    </div>
  );
}


function AccessDenied({ label }: { label: string }) {
  return (
    <div className="p-8">
      <p className="text-red-600">You do not have permission to view {label}.</p>
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
    <div className="flex flex-col items-center gap-4 py-12 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-100">
        <Icon className="h-7 w-7 text-slate-400" />
      </div>
      <div>
        <p className="font-medium text-slate-700">{title}</p>
        <p className="text-sm text-slate-500 mt-1 max-w-sm">{description}</p>
      </div>
    </div>
  );
}
