import { AuthError, requireOrgMember } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import type { OrgRole } from "@prisma/client";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { RecordEvidenceActions } from "../record-evidence-actions";

interface RecordDetailPageProps {
  params: Promise<{ orgId: string; id: string }>;
}

const REVIEW_LABELS: Record<string, string> = {
  draft: "Draft",
  in_review: "In review",
  approved: "Approved",
  rejected: "Rejected",
};

export default async function RecordDetailPage({ params }: RecordDetailPageProps) {
  const { orgId, id } = await params;

  let role: OrgRole;
  try {
    const result = await requireOrgMember(orgId, "admin", "editor", "reviewer", "viewer", "auditor");
    role = result.membership.role;
  } catch (err) {
    if (err instanceof AuthError) {
      if (err.status === 401) redirect("/sign-in");
      return (
        <div className="p-[42px]">
          <p className="text-sm text-[#222222] tracking-[-0.42px]">
            You do not have permission to view activity records.
          </p>
        </div>
      );
    }
    throw err;
  }

  const canManage = role === "admin" || role === "editor" || role === "reviewer";

  const record = await prisma.activityRecord.findUnique({
    where: { id },
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
      calculations: {
        include: {
          methodologyVersion: { select: { name: true, gwpVersion: true } },
          calculationRun: {
            include: {
              factorLibrary: { select: { name: true, version: true } },
            },
          },
        },
        orderBy: { createdAt: "desc" },
        take: 5,
      },
      importBatch: {
        select: { id: true, sourceFilename: true, state: true },
      },
      _count: { select: { calculations: true } },
    },
  });

  if (!record || record.organizationId !== orgId) {
    notFound();
  }

  // Separately fetch field submission if this record came from one
  const fieldSubmission = record.fieldSubmissionId
    ? await prisma.fieldSubmission.findUnique({
        where: { id: record.fieldSubmissionId },
        select: {
          id: true,
          documentType: true,
          status: true,
          submittedBy: { select: { name: true, email: true } },
        },
      })
    : null;

  return (
    <div className="p-[42px] max-w-[900px] mx-auto">
      <div className="mb-[42px]">
        <Link
          href={`/orgs/${orgId}/records`}
          className="inline-flex items-center gap-1.5 text-xs text-[#333333] hover:text-[#0f3e17] tracking-[-0.36px] mb-[14px] transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to records
        </Link>
        <p className="text-xs font-normal tracking-[-0.36px] text-[#0f3e17] bg-[#b6ced5] rounded-full px-[14px] py-[7px] inline-flex mb-[14px] ml-3">
          Records
        </p>
        <h1
          className="text-[40px] leading-[1.35] tracking-[-0.4px] text-[#0f3e17]"
          style={{ fontFamily: "var(--font-fraunces, Fraunces, Georgia, serif)", fontWeight: 300 }}
        >
          {record.sourceDescription ?? record.supplierName ?? "Activity record"}
        </h1>
        <div className="flex flex-wrap items-center gap-3 mt-[7px]">
          <Badge variant={record.reviewStatus === "approved" ? "default" : "outline"}>
            {REVIEW_LABELS[record.reviewStatus] ?? record.reviewStatus}
          </Badge>
          <p className="text-sm text-[#222222] font-normal tracking-[-0.42px]">
            Scope {record.emissionCategory.scope}: {record.emissionCategory.name}
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-[21px]">
        <div className="grid gap-[21px] md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Record details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <DetailRow
                label="Category"
                value={`Scope ${record.emissionCategory.scope}: ${record.emissionCategory.name}`}
              />
              {record.emissionCategory.code && (
                <DetailRow label="Code" value={record.emissionCategory.code} />
              )}
              <DetailRow
                label="Amount"
                value={`${Number(record.amount).toLocaleString("en-GB")} ${record.unit}`}
              />
              <DetailRow label="Period" value={record.reportingPeriod.label} />
              {record.facility && <DetailRow label="Facility" value={record.facility.name} />}
              {record.businessUnit && <DetailRow label="Business unit" value={record.businessUnit.name} />}
              {record.country && <DetailRow label="Country" value={record.country} />}
              {record.supplierName && <DetailRow label="Supplier" value={record.supplierName} />}
              {record.sourceDescription && <DetailRow label="Source" value={record.sourceDescription} />}
              {record.fuelType && <DetailRow label="Fuel type" value={record.fuelType} />}
              {record.refrigerantType && <DetailRow label="Refrigerant" value={record.refrigerantType} />}
              {record.transportMode && <DetailRow label="Transport mode" value={record.transportMode} />}
              <DetailRow label="Evidence status" value={record.evidenceStatus.replaceAll("_", " ")} />
              {record.activityDate && (
                <DetailRow
                  label="Activity date"
                  value={new Date(record.activityDate).toLocaleDateString("en-GB", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}
                />
              )}
              {record.assumptionNotes && (
                <DetailRow label="Assumptions" value={record.assumptionNotes} />
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Route information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {record.pickupPostcode || record.deliveryPostcode ? (
                <>
                  {record.pickupPostcode && (
                    <DetailRow label="Pickup postcode" value={record.pickupPostcode} />
                  )}
                  {record.deliveryPostcode && (
                    <DetailRow label="Delivery postcode" value={record.deliveryPostcode} />
                  )}
                  {record.distanceAmount != null && (
                    <DetailRow
                      label="Distance"
                      value={`${Number(record.distanceAmount).toFixed(2)} ${record.distanceUnit ?? "km"}${record.routeDistanceSource ? ` via ${record.routeDistanceSource}` : ""}`}
                    />
                  )}
                  {record.pickupLat != null && record.pickupLng != null && (
                    <DetailRow
                      label="Pickup coords"
                      value={`${Number(record.pickupLat).toFixed(5)}, ${Number(record.pickupLng).toFixed(5)}`}
                    />
                  )}
                  {record.deliveryLat != null && record.deliveryLng != null && (
                    <DetailRow
                      label="Delivery coords"
                      value={`${Number(record.deliveryLat).toFixed(5)}, ${Number(record.deliveryLng).toFixed(5)}`}
                    />
                  )}
                  {record.distanceOverrideReason && (
                    <DetailRow label="Override reason" value={record.distanceOverrideReason} />
                  )}
                </>
              ) : (
                <p className="text-sm text-[#333333] italic tracking-[-0.42px]">No route information</p>
              )}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Evidence files{" "}
              <span className="text-sm font-normal text-[#333333]">({record.evidence.length})</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {record.evidence.length === 0 ? (
              <p className="text-sm text-[#333333] italic tracking-[-0.42px]">No evidence files attached</p>
            ) : (
              <RecordEvidenceActions
                orgId={orgId}
                recordId={id}
                files={record.evidence.map((item) => ({
                  id: item.evidenceFile.id,
                  filename: item.evidenceFile.filename,
                }))}
                canManage={canManage}
              />
            )}
          </CardContent>
        </Card>

        {record.calculations.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                Emission calculations{" "}
                <span className="text-sm font-normal text-[#333333]">({record._count.calculations})</span>
              </CardTitle>
              <CardDescription>
                Immutable calculation results from approved runs. Most recent shown first.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="divide-y divide-[#e5e7eb] rounded-[14px] border border-[#e5e7eb]">
                {record.calculations.map((calc) => (
                  <div key={calc.id} className="flex items-start justify-between gap-4 p-4">
                    <div className="min-w-0">
                      <p className="text-sm font-normal text-[#0f3e17] tracking-[-0.42px]">
                        {Number(calc.totalCo2e).toLocaleString("en-GB", { maximumFractionDigits: 4 })} kgCO2e
                      </p>
                      <p className="mt-0.5 text-xs text-[#333333] tracking-[-0.36px]">
                        {calc.methodologyVersionName} · {calc.factorLibraryVersion}
                      </p>
                      <p className="mt-0.5 text-xs text-[#333333] tracking-[-0.36px]">
                        {calc.calculationRun.factorLibrary.name} {calc.calculationRun.factorLibrary.version}
                      </p>
                      {calc.formula && (
                        <p className="mt-1 font-mono text-xs text-[#333333]">{calc.formula}</p>
                      )}
                    </div>
                    <time className="shrink-0 text-xs text-[#333333] tracking-[-0.36px]">
                      {calc.createdAt.toLocaleDateString("en-GB", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </time>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {(fieldSubmission || record.importBatch) && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Data provenance</CardTitle>
              <CardDescription>
                Where this record originated before it was committed.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {fieldSubmission && (
                <div className="rounded-[14px] border border-[#e5e7eb] p-4">
                  <p className="text-xs font-normal text-[#333333] tracking-[-0.36px] mb-1">
                    From field submission
                  </p>
                  <p className="text-sm text-[#0f3e17] tracking-[-0.42px]">
                    {fieldSubmission.documentType.replaceAll("_", " ")} by{" "}
                    {fieldSubmission.submittedBy.name ?? fieldSubmission.submittedBy.email}
                  </p>
                  <Link
                    href={`/orgs/${orgId}/submissions/${fieldSubmission.id}`}
                    className="mt-2 inline-flex text-xs text-[#0f3e17] underline underline-offset-2 tracking-[-0.36px] hover:opacity-70"
                  >
                    View submission
                  </Link>
                </div>
              )}
              {record.importBatch && (
                <div className="rounded-[14px] border border-[#e5e7eb] p-4">
                  <p className="text-xs font-normal text-[#333333] tracking-[-0.36px] mb-1">
                    From import batch
                  </p>
                  <p className="text-sm text-[#0f3e17] tracking-[-0.42px]">
                    {record.importBatch.sourceFilename}
                  </p>
                  <p className="mt-0.5 text-xs text-[#333333] tracking-[-0.36px]">
                    {record.importBatch.state.replaceAll("_", " ")}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:gap-3">
      <p className="text-xs font-normal text-[#333333] tracking-[-0.36px] sm:w-36 shrink-0 capitalize">{label}</p>
      <p className="text-sm text-[#0f3e17] tracking-[-0.42px]">{value}</p>
    </div>
  );
}
