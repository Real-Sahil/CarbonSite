export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireOrgMember, AuthError } from "@/lib/auth/session";
import { SupplierRequestsTable } from "./supplier-requests-table";

interface PageProps {
  params: Promise<{ orgId: string }>;
  searchParams: Promise<{ status?: string; period?: string }>;
}

export default async function SuppliersSettingsPage({ params, searchParams }: PageProps) {
  const { orgId } = await params;
  const { status: statusFilter, period: periodFilter } = await searchParams;

  try {
    await requireOrgMember(orgId, "admin");
  } catch (err) {
    if (err instanceof AuthError) {
      if (err.status === 401) redirect("/sign-in");
      return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-8">
          <div className="rounded-full bg-amber-50 p-4 mb-4">
            <svg className="h-6 w-6 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
            </svg>
          </div>
          <h2 className="text-sm font-semibold text-gray-900 mb-1">Admin access required</h2>
          <p className="text-sm text-gray-500 max-w-sm">
            Managing supplier data requests requires admin access. Contact your organisation admin to request elevated permissions.
          </p>
        </div>
      );
    }
    throw err;
  }

  const [requests, periods] = await Promise.all([
    prisma.supplierDataRequest.findMany({
      where: {
        organizationId: orgId,
        ...(statusFilter && statusFilter !== "all" ? { status: statusFilter } : {}),
        ...(periodFilter ? { reportingPeriodId: periodFilter } : {}),
      },
      select: {
        id: true,
        supplierEmail: true,
        supplierName: true,
        categoryCode: true,
        status: true,
        sentAt: true,
        openedAt: true,
        submittedAt: true,
        expiresAt: true,
        notes: true,
        submittedData: true,
        reportingPeriod: { select: { id: true, label: true } },
        createdBy: { select: { name: true, email: true } },
      },
      orderBy: { sentAt: "desc" },
    }),
    prisma.reportingPeriod.findMany({
      where: { organizationId: orgId },
      select: { id: true, label: true },
      orderBy: { startDate: "desc" },
    }),
  ]);

  const rows = requests.map((r) => ({
    id: r.id,
    supplierEmail: r.supplierEmail,
    supplierName: r.supplierName,
    categoryCode: r.categoryCode,
    categoryName: r.categoryCode.replace(/^s\d-/, "").replace(/-/g, " "),
    status: r.status as "sent" | "opened" | "submitted" | "expired",
    sentAt: r.sentAt.toISOString(),
    openedAt: r.openedAt?.toISOString() ?? null,
    submittedAt: r.submittedAt?.toISOString() ?? null,
    expiresAt: r.expiresAt.toISOString(),
    expired: r.expiresAt < new Date() && r.status !== "submitted",
    notes: r.notes,
    submittedData: r.submittedData as {
      quantity: number;
      unit: string;
      description?: string | null;
    } | null,
    periodId: r.reportingPeriod.id,
    periodLabel: r.reportingPeriod.label,
    sentBy: r.createdBy.name ?? r.createdBy.email,
  }));

  // Status counts for filter chips.
  const counts = {
    all: rows.length,
    sent: rows.filter((r) => r.status === "sent" && !r.expired).length,
    opened: rows.filter((r) => r.status === "opened" && !r.expired).length,
    submitted: rows.filter((r) => r.status === "submitted").length,
    expired: rows.filter((r) => r.expired).length,
  };

  return (
    <SupplierRequestsTable
      orgId={orgId}
      rows={rows}
      counts={counts}
      periods={periods}
      currentStatus={statusFilter ?? "all"}
      currentPeriod={periodFilter ?? ""}
    />
  );
}
