import { redirect } from "next/navigation";
import { requireSession, AuthError } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import Link from "next/link";
import { format } from "date-fns";

export const dynamic = "force-dynamic";

const STATUS_LABELS: Record<string, string> = {
  sent: "Awaiting your data",
  opened: "In progress",
  submitted: "Submitted",
  flagged: "Needs attention",
  approved: "Approved",
  rejected: "Returned",
  converted: "Approved",
};

async function sessionOrSignIn() {
  try {
    return await requireSession();
  } catch (err) {
    // A signed-out supplier (an expired session, a bookmarked link) is sent to
    // sign in rather than shown a server error.
    if (err instanceof AuthError && err.status === 401) redirect("/sign-in");
    throw err;
  }
}

export default async function SupplierPortalPage() {
  const { user } = await sessionOrSignIn();

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
    return STATUS_LABELS[status] ?? status;
  };

  return (
    <div className="min-h-screen bg-zinc-50">
      <div className="mx-auto max-w-7xl px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-semibold tracking-tight text-zinc-900">Data submission portal</h1>
          <p className="mt-2 text-zinc-600">Welcome, {user.name || user.email}</p>
          <p className="text-sm text-zinc-500">{supplierMembership.organization.name}</p>
        </div>

        {/* Summary cards */}
        <div className="mb-8 grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-zinc-600">Total requests</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{requests.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-zinc-600">Awaiting submission</CardTitle>
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
              <CardTitle className="text-sm font-medium text-zinc-600">Needs attention</CardTitle>
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
                <p className="mt-1 text-sm text-zinc-500">Check back later or contact your administrator.</p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Your data requests</CardTitle>
              <CardDescription>Review and submit emissions data for each category and period</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Category</TableHead>
                    <TableHead>Period</TableHead>
                    <TableHead>Deadline</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {requests.map((request) => {
                    const categoryName = request.categoryCode.replace(/^s\d-/, "").replace(/-/g, " ");
                    return (
                      <TableRow key={request.id}>
                        <TableCell className="font-medium capitalize">{categoryName}</TableCell>
                        <TableCell className="text-zinc-600">{request.reportingPeriod.label}</TableCell>
                        <TableCell className="text-zinc-600 tabular-nums">
                          {format(new Date(request.expiresAt), "d MMM yyyy")}
                        </TableCell>
                        <TableCell>
                          <Badge variant={getStatusColor(request.status, request.expiresAt)}>
                            {getStatusLabel(request.status, request.expiresAt)}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button asChild variant="ghost" size="sm">
                            <Link href={`/supplier-portal/${request.id}`}>
                              {request.status === "approved" ? "View" : "Review"}
                            </Link>
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
