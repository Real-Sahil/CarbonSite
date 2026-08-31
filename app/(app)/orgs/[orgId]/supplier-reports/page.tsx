export const dynamic = "force-dynamic";

import { requireOrgMember } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { SupplierReportsClient } from "./supplier-reports-client";

interface Props {
  params: Promise<{ orgId: string }>;
  searchParams: Promise<{ status?: string; cursor?: string }>;
}

const STATUS_TABS = [
  { value: "submitted", label: "Pending Review" },
  { value: "under_review", label: "In Review" },
  { value: "accepted", label: "Accepted" },
  { value: "rejected", label: "Rejected" },
  { value: "all", label: "All" },
];

export default async function SupplierReportsPage({ params, searchParams }: Props) {
  const { orgId } = await params;
  const { status: rawStatus, cursor } = await searchParams;

  const status = STATUS_TABS.some((t) => t.value === rawStatus) ? rawStatus! : "submitted";

  let role: string | undefined;
  try {
    const { membership } = await requireOrgMember(orgId, "admin", "editor", "reviewer", "auditor");
    role = membership.role;
  } catch {
    redirect("/sign-in");
  }

  const limit = 25;

  const reports = await prisma.supplierReport.findMany({
    where: {
      organizationId: orgId,
      ...(status !== "all" ? { status } : {}),
    },
    orderBy: { submittedAt: "desc" },
    take: limit + 1,
    ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    select: {
      id: true,
      supplierEmail: true,
      supplierName: true,
      supplierDomain: true,
      reportingYear: true,
      totalAmount: true,
      unit: true,
      calculationMethod: true,
      qualityScore: true,
      qualityFlags: true,
      status: true,
      submittedAt: true,
      reviewedAt: true,
      rejectionReason: true,
      convertedToRecordId: true,
      notes: true,
      emissionCategory: { select: { code: true, name: true, scope: true } },
      reviewedBy: { select: { name: true, email: true } },
    },
  });

  const hasMore = reports.length > limit;
  const page = hasMore ? reports.slice(0, limit) : reports;
  const nextCursor = hasMore ? page[page.length - 1].id : null;

  // Count across all statuses for tabs
  const counts = await prisma.supplierReport.groupBy({
    by: ["status"],
    where: { organizationId: orgId },
    _count: { id: true },
  });
  const countMap = Object.fromEntries(counts.map((c) => [c.status, c._count.id]));
  const total = counts.reduce((sum, c) => sum + c._count.id, 0);

  // Reporting periods for the accept dialog
  const reportingPeriods = await prisma.reportingPeriod.findMany({
    where: { organizationId: orgId },
    select: { id: true, label: true, startDate: true, endDate: true },
    orderBy: { startDate: "desc" },
  });

  const serialized = page.map((r) => ({
    ...r,
    totalAmount: r.totalAmount.toString(),
    submittedAt: r.submittedAt.toISOString(),
    reviewedAt: r.reviewedAt?.toISOString() ?? null,
  }));

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="border-b border-slate-700/60 px-6 py-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-lg font-semibold text-slate-100">Supplier Reports</h1>
            <p className="mt-0.5 text-sm text-slate-400">
              Review Scope 3 data submitted by your suppliers. Accept to convert into an activity record.
            </p>
          </div>
          <div className="text-right shrink-0">
            <span className="text-2xl font-bold text-slate-100">{total}</span>
            <span className="ml-1.5 text-sm text-slate-400">total reports</span>
          </div>
        </div>

        {/* Status tabs */}
        <div className="mt-4 flex gap-1 flex-wrap">
          {STATUS_TABS.map((tab) => {
            const count = tab.value === "all" ? total : (countMap[tab.value] ?? 0);
            const isActive = status === tab.value;
            return (
              <a
                key={tab.value}
                href={`?status=${tab.value}`}
                className={[
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors",
                  isActive
                    ? "bg-amber-500/15 text-amber-300 border border-amber-500/20"
                    : "text-slate-400 hover:text-slate-200 hover:bg-slate-700/50 border border-transparent",
                ].join(" ")}
              >
                {tab.label}
                {count > 0 && (
                  <span className={[
                    "rounded-full px-1.5 py-0.5 text-[10px] font-semibold",
                    isActive ? "bg-amber-500/20 text-amber-300" : "bg-slate-700 text-slate-400",
                  ].join(" ")}>
                    {count}
                  </span>
                )}
              </a>
            );
          })}
        </div>
      </div>

      <SupplierReportsClient
        orgId={orgId}
        reports={serialized}
        nextCursor={nextCursor}
        status={status}
        role={role ?? "viewer"}
        reportingPeriods={reportingPeriods.map((p) => ({
          ...p,
          startDate: p.startDate.toISOString(),
          endDate: p.endDate.toISOString(),
        }))}
      />
    </div>
  );
}
