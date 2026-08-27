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

async function AuditTrailTable({
  orgId,
  page,
}: {
  orgId: string;
  page: number;
}) {
  const res = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/orgs/${orgId}/audit-logs?limit=25`, {
    headers: {
      Cookie: "session=test", // Server-side auth
    },
  });

  if (!res.ok) {
    return <div className="text-red-600">Failed to load audit logs</div>;
  }

  const data = await res.json();

  const actionColors: Record<string, string> = {
    INSERT: "bg-green-100 text-green-800",
    UPDATE: "bg-blue-100 text-blue-800",
    DELETE: "bg-red-100 text-red-800",
  };

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Timestamp</TableHead>
          <TableHead>Actor</TableHead>
          <TableHead>Action</TableHead>
          <TableHead>Table</TableHead>
          <TableHead>Record ID</TableHead>
          <TableHead>IP Address</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {data.items.map((event: any) => (
          <TableRow key={event.id}>
            <TableCell className="text-sm">
              {new Date(event.timestamp).toLocaleString()}
            </TableCell>
            <TableCell className="text-sm">{event.actorId || "System"}</TableCell>
            <TableCell>
              <Badge className={actionColors[event.action] || "bg-gray-100 text-gray-800"}>
                {event.action}
              </Badge>
            </TableCell>
            <TableCell className="text-sm font-mono text-xs">{event.tableName}</TableCell>
            <TableCell className="text-sm font-mono text-xs truncate max-w-[150px]">
              {event.recordId || "—"}
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
              <label className="text-sm font-medium">Table Name</label>
              <Select>
                <SelectTrigger>
                  <SelectValue placeholder="All tables" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="EmissionCalculation">Emission Calculations</SelectItem>
                  <SelectItem value="PublishedSnapshot">Published Snapshots</SelectItem>
                  <SelectItem value="Report">Reports</SelectItem>
                  <SelectItem value="ImportBatch">Import Batches</SelectItem>
                  <SelectItem value="FieldSubmission">Field Submissions</SelectItem>
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
                  <SelectItem value="INSERT">INSERT</SelectItem>
                  <SelectItem value="UPDATE">UPDATE</SelectItem>
                  <SelectItem value="DELETE">DELETE</SelectItem>
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
            <AuditTrailTable orgId={orgId} page={1} />
          </Suspense>
        </CardContent>
      </Card>
    </div>
  );
}
