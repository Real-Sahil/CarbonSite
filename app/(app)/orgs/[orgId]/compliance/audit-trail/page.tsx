"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";

interface AuditLogEntry {
  id: string;
  timestamp: string;
  action: string;
  resourceType: string;
  resourceId: string;
  actor: {
    id: string;
    email: string;
    name: string | null;
  } | null;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}

interface PaginatedResponse {
  data: AuditLogEntry[];
  pagination: {
    offset: number;
    limit: number;
    total: number;
  };
}

const actionColorMap: Record<string, string> = {
  "org.created": "bg-blue-100 text-blue-800",
  "org.updated": "bg-yellow-100 text-yellow-800",
  "record.created": "bg-green-100 text-green-800",
  "record.updated": "bg-yellow-100 text-yellow-800",
  "record.deleted": "bg-red-100 text-red-800",
  "calculation.run": "bg-purple-100 text-purple-800",
  "snapshot.published": "bg-green-100 text-green-800",
  "report.generated": "bg-blue-100 text-blue-800",
  "field_submission.reviewed": "bg-indigo-100 text-indigo-800",
  "auth.login": "bg-gray-100 text-gray-800",
  "auth.logout": "bg-gray-100 text-gray-800",
  "user.created": "bg-green-100 text-green-800",
  "user.role_changed": "bg-orange-100 text-orange-800",
};

export default function AuditTrailPage() {
  const params = useParams();
  const orgId = params.orgId as string;

  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [offset, setOffset] = useState(0);
  const limit = 50;
  const [filters, setFilters] = useState({
    resourceType: "",
    action: "",
  });

  useEffect(() => {
    const loadLogs = async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams({
          limit: limit.toString(),
          offset: offset.toString(),
          ...(filters.resourceType && { resourceType: filters.resourceType }),
          ...(filters.action && { action: filters.action }),
        });

        const response = await fetch(`/api/orgs/${orgId}/audit-logs?${params}`);
        const data: PaginatedResponse = await response.json();
        setLogs(data.data);
        setTotal(data.pagination.total);
      } catch (error) {
        console.error("Failed to fetch audit logs:", error);
      } finally {
        setLoading(false);
      }
    };

    loadLogs();
  }, [orgId, offset, limit, filters]);

  const pages = Math.ceil(total / limit);
  const currentPage = Math.floor(offset / limit) + 1;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Audit Trail</h1>
        <p className="text-gray-600 mt-2">
          Complete record of all actions and changes in your organization.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
          <CardDescription>Search and filter audit logs by action or resource type</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium">Resource Type</label>
              <Input
                placeholder="e.g., activity_record, report"
                value={filters.resourceType}
                onChange={(e) => {
                  setFilters({ ...filters, resourceType: e.target.value });
                  setOffset(0);
                }}
              />
            </div>
            <div>
              <label className="text-sm font-medium">Action</label>
              <Input
                placeholder="e.g., created, updated"
                value={filters.action}
                onChange={(e) => {
                  setFilters({ ...filters, action: e.target.value });
                  setOffset(0);
                }}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Activity Log</CardTitle>
          <CardDescription>Showing {logs.length} of {total} entries</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Timestamp</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Resource</TableHead>
                  <TableHead>Actor</TableHead>
                  <TableHead>IP Address</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell colSpan={5}>
                        <Skeleton className="h-4 w-full" />
                      </TableCell>
                    </TableRow>
                  ))
                ) : logs.length > 0 ? (
                  logs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="text-sm">
                        {format(new Date(log.timestamp), "MMM d, yyyy HH:mm:ss")}
                      </TableCell>
                      <TableCell>
                        <Badge className={actionColorMap[log.action] || "bg-gray-100 text-gray-800"}>
                          {log.action}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">
                        {log.resourceType}#{log.resourceId.slice(0, 8)}
                      </TableCell>
                      <TableCell className="text-sm">
                        {log.actor?.name || log.actor?.email || "System"}
                      </TableCell>
                      <TableCell className="text-sm text-gray-500">{log.ipAddress || "—"}</TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-gray-500 py-8">
                      No audit logs found
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          <div className="mt-6 flex items-center justify-between">
            <div className="text-sm text-gray-600">
              Page {currentPage} of {pages}
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                disabled={offset === 0}
                onClick={() => setOffset(Math.max(0, offset - limit))}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                disabled={offset + limit >= total}
                onClick={() => setOffset(offset + limit)}
              >
                Next
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
