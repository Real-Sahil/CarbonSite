export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireOrgMember, AuthError } from "@/lib/auth/session";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SupplierRequestsTable } from "./supplier-requests-table";
import { SupplierAccountsPage } from "./suppliers-accounts-page";
import { MetricsDashboard } from "./metrics-dashboard";

interface PageProps {
  params: Promise<{ orgId: string }>;
  searchParams: Promise<{ status?: string; period?: string; tab?: string }>;
}

export default async function SuppliersSettingsPage({ params, searchParams }: PageProps) {
  const { orgId } = await params;
  const { status: statusFilter, period: periodFilter, tab = "requests" } = await searchParams;

  try {
    await requireOrgMember(orgId, "admin");
  } catch (err) {
    if (err instanceof AuthError) redirect("/sign-in");
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
        qualityFlags: true,
        rejectionReason: true,
        reviewedAt: true,
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
    status: r.status as "sent" | "opened" | "submitted" | "expired" | "flagged" | "approved" | "rejected",
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
    qualityFlags: r.qualityFlags as Array<{
      field: string;
      severity: "warning" | "critical" | "info";
      message: string;
      suggestedRange?: { min: number; max: number };
    }> | null,
    rejectionReason: r.rejectionReason,
    reviewedAt: r.reviewedAt?.toISOString() ?? null,
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
    <Tabs defaultValue={tab} className="w-full">
      <TabsList>
        <TabsTrigger value="requests">Requests</TabsTrigger>
        <TabsTrigger value="accounts">Accounts</TabsTrigger>
        <TabsTrigger value="metrics">Metrics</TabsTrigger>
      </TabsList>

      <TabsContent value="requests">
        <SupplierRequestsTable
          orgId={orgId}
          rows={rows}
          counts={counts}
          periods={periods}
          currentStatus={statusFilter ?? "all"}
          currentPeriod={periodFilter ?? ""}
        />
      </TabsContent>

      <TabsContent value="accounts">
        <SupplierAccountsPage orgId={orgId} />
      </TabsContent>

      <TabsContent value="metrics">
        <MetricsDashboard />
      </TabsContent>
    </Tabs>
  );
}
