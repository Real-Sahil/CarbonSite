import { Suspense } from "react";
import { Metadata } from "next";
import { requireOrgMember } from "@/lib/auth/session";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const metadata: Metadata = {
  title: "Audit Trail",
};

interface AuditLogEvent {
  id: string;
  actorUserId: string | null;
  action: string;
  resourceType: string;
  resourceId: string;
  metadata: Record<string, unknown>;
  createdAt: string;
  ipAddress: string | null;
  userAgent: string | null;
}

interface AuditLogsResponse {
  items: AuditLogEvent[];
  pagination: {
    nextCursor: string | null;
    hasMore: boolean;
    limit: number;
  };
}

async function AuditTrailTable({
  orgId,
}: {
  orgId: string;
}) {
  const res = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/orgs/${orgId}/audit-logs?limit=25`, {
    headers: {
      Cookie: "session=test", // Server-side auth
    },
  });

  if (!res.ok) {
    return <div className="text-red-600">Failed to load audit logs</div>;
  }

  const data: AuditLogsResponse = await res.json();

  const actionColors: Record<string, string> = {
    create: "bg-green-100 text-green-800",
    update: "bg-blue-100 text-blue-800",
    delete: "bg-red-100 text-red-800",
    approve: "bg-purple-100 text-purple-800",
    reject: "bg-orange-100 text-orange-800",
  };

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Timestamp</TableHead>
          <TableHead>Actor</TableHead>
          <TableHead>Action</TableHead>
          <TableHead>Resource Type</TableHead>
          <TableHead>Resource ID</TableHead>
          <TableHead>IP Address</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {data.items.map((event: AuditLogEvent) => (
          <TableRow key={event.id}>
            <TableCell className="text-sm">
              {new Date(event.createdAt).toLocaleString()}
            </TableCell>
            <TableCell className="text-sm">{event.actorUserId || "System"}</TableCell>
            <TableCell>
              <Badge className={actionColors[event.action] || "bg-gray-100 text-gray-800"}>
                {event.action}
              </Badge>
            </TableCell>
            <TableCell className="text-sm font-mono text-xs">{event.resourceType}</TableCell>
            <TableCell className="text-sm font-mono text-xs truncate max-w-[150px]">
              {event.resourceId || "—"}
            </TableCell>
            <TableCell className="text-sm text-gray-500">{event.ipAddress || "—"}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

export default async function AuditTrailPage({
  params,
}: {
  params: Promise<{ orgId: string }>;
}) {
  const { orgId } = await params;
  const { membership } = await requireOrgMember(orgId, "admin", "auditor", "reviewer");

  if (!["admin", "auditor", "reviewer"].includes(membership.role)) {
    return <div className="text-red-600">Access denied</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Audit Trail</h1>
        <p className="text-gray-600 mt-2">Database-level activity log for compliance auditing</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filter Audit Events</CardTitle>
          <CardDescription>Filter by table, action, or date range</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="text-sm font-medium">Resource Type</label>
              <Select>
                <SelectTrigger>
                  <SelectValue placeholder="All resources" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="EmissionCalculation">Emission Calculations</SelectItem>
                  <SelectItem value="PublishedSnapshot">Published Snapshots</SelectItem>
                  <SelectItem value="Report">Reports</SelectItem>
                  <SelectItem value="ImportBatch">Import Batches</SelectItem>
                  <SelectItem value="FieldSubmission">Field Submissions</SelectItem>
                  <SelectItem value="ActivityRecord">Activity Records</SelectItem>
                  <SelectItem value="Organization">Organization</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium">Action</label>
              <Select>
                <SelectTrigger>
                  <SelectValue placeholder="All actions" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="create">Create</SelectItem>
                  <SelectItem value="update">Update</SelectItem>
                  <SelectItem value="delete">Delete</SelectItem>
                  <SelectItem value="approve">Approve</SelectItem>
                  <SelectItem value="reject">Reject</SelectItem>
                  <SelectItem value="publish">Publish</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium">Start Date</label>
              <Input type="datetime-local" />
            </div>

            <div>
              <label className="text-sm font-medium">End Date</label>
              <Input type="datetime-local" />
            </div>
          </div>

          <Button className="w-full md:w-auto">Apply Filters</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent Audit Events</CardTitle>
          <CardDescription>Latest database changes across your organization</CardDescription>
        </CardHeader>
        <CardContent>
          <Suspense fallback={<div className="text-gray-500">Loading audit logs...</div>}>
            <AuditTrailTable orgId={orgId} />
          </Suspense>
        </CardContent>
      </Card>
    </div>
  );
}
