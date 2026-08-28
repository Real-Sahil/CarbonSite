import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { format } from "date-fns";

export const dynamic = "force-dynamic";

export default async function SupplierPortalPage() {
  const { user } = await requireSession();

  // Check if user is a supplier
  const supplierMembership = await prisma.organizationMembership.findFirst({
    where: {
      userId: user.id,
      role: "supplier",
    },
    include: {
      organization: {
        select: {
          name: true,
          id: true,
        },
      },
    },
  });

  if (!supplierMembership) {
    redirect("/sign-in");
  }

  // Get supplier's last login
  const lastSession = await prisma.session.findFirst({
    where: { userId: user.id },
    select: { createdAt: true },
    orderBy: { createdAt: "desc" },
  });

  // Get supplier's assigned data requests
  const requests = await prisma.supplierDataRequest.findMany({
    where: {
      organizationId: supplierMembership.organizationId,
      supplierEmail: user.email,
    },
    select: {
      id: true,
      categoryCode: true,
      status: true,
      expiresAt: true,
      submittedAt: true,
      reportingPeriod: { select: { id: true, label: true } },
    },
    orderBy: { expiresAt: "asc" },
  });

  const getStatusColor = (status: string, expiresAt: Date) => {
    if (expiresAt < new Date() && status !== "submitted") return "destructive";
    if (status === "approved") return "default";
    if (status === "rejected" || status === "flagged") return "secondary";
    return "outline";
  };

  const getStatusLabel = (status: string, expiresAt: Date) => {
    if (expiresAt < new Date() && status !== "submitted") return "Expired";
    return status.charAt(0).toUpperCase() + status.slice(1);
  };

  return (
    <div className="min-h-screen bg-zinc-50">
      <div className="mx-auto max-w-7xl px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold tracking-tight text-zinc-900">Data Submission Portal</h1>
          <p className="mt-2 text-zinc-600">Welcome, {user.name || user.email}</p>
          <p className="text-sm text-zinc-500">{supplierMembership.organization.name}</p>
        </div>

        {/* Summary cards */}
        <div className="mb-8 grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-zinc-600">Total Requests</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{requests.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-zinc-600">Awaiting Submission</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {requests.filter((r) => r.status === "sent" || r.status === "opened").length}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-zinc-600">Approved</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {requests.filter((r) => r.status === "approved").length}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-zinc-600">Needs Attention</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-amber-600">
                {requests.filter((r) => r.status === "rejected" || r.status === "flagged").length}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Requests table */}
        {requests.length === 0 ? (
          <Card>
            <CardContent className="py-12">
              <div className="text-center">
                <p className="text-zinc-500">No data requests assigned yet.</p>
                <p className="mt-1 text-sm text-zinc-400">Check back later or contact your administrator.</p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Your Data Requests</CardTitle>
              <CardDescription>Review and submit emissions data for each category and period</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-zinc-200">
                      <th className="px-4 py-3 text-left font-medium text-zinc-600">Category</th>
                      <th className="px-4 py-3 text-left font-medium text-zinc-600">Period</th>
                      <th className="px-4 py-3 text-left font-medium text-zinc-600">Deadline</th>
                      <th className="px-4 py-3 text-left font-medium text-zinc-600">Status</th>
                      <th className="px-4 py-3 text-left font-medium text-zinc-600">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {requests.map((request) => {
                      const categoryName = request.categoryCode.replace(/^s\d-/, "").replace(/-/g, " ");
                      const isExpired = request.expiresAt < new Date() && request.status !== "submitted";
                      const statusColor = getStatusColor(request.status, request.expiresAt);
                      const statusLabel = getStatusLabel(request.status, request.expiresAt);

                      return (
                        <tr key={request.id} className="border-b border-zinc-200 hover:bg-zinc-50">
                          <td className="px-4 py-3">
                            <div className="font-medium capitalize text-zinc-900">{categoryName}</div>
                          </td>
                          <td className="px-4 py-3 text-zinc-600">{request.reportingPeriod.label}</td>
                          <td className="px-4 py-3 text-zinc-600">
                            {format(new Date(request.expiresAt), "MMM d, yyyy")}
                          </td>
                          <td className="px-4 py-3">
                            <Badge variant={statusColor}>{statusLabel}</Badge>
                          </td>
                          <td className="px-4 py-3">
                            <Link href={`/supplier-portal/${request.id}`}>
                              <Button variant="ghost" size="sm">
                                {request.status === "approved" ? "View" : "Review"}
                              </Button>
                            </Link>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
