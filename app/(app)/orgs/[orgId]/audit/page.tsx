import { redirect } from "next/navigation";
import { Clock } from "lucide-react";
import { Prisma } from "@prisma/client";
import { AuthError, requireOrgMember } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";

interface AuditPageProps {
  params: Promise<{ orgId: string }>;
  searchParams: Promise<{
    action?: string;
    actor?: string;
    resource?: string;
    since?: string;
  }>;
}

const PAGE_SIZE = 100;

export default async function AuditPage({ params, searchParams }: AuditPageProps) {
  const { orgId } = await params;
  const filters = await searchParams;

  try {
    await requireOrgMember(orgId, "admin", "editor", "reviewer", "viewer", "auditor");
  } catch (err) {
    if (err instanceof AuthError) {
      if (err.status === 401) redirect("/sign-in");
      return <AccessDenied />;
    }
    throw err;
  }

  const where = buildAuditWhere(orgId, filters);
  const [logs, actionOptions, resourceOptions, totalCount] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      include: { actor: { select: { name: true, email: true } } },
      orderBy: { createdAt: "desc" },
      take: PAGE_SIZE,
    }),
    prisma.auditLog.findMany({
      where: { organizationId: orgId },
      distinct: ["action"],
      select: { action: true },
      orderBy: { action: "asc" },
    }),
    prisma.auditLog.findMany({
      where: { organizationId: orgId },
      distinct: ["resourceType"],
      select: { resourceType: true },
      orderBy: { resourceType: "asc" },
    }),
    prisma.auditLog.count({ where }),
  ]);

  return (
    <div className="p-[42px] max-w-[1200px] mx-auto flex flex-col gap-[42px]">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs font-normal tracking-[-0.36px] text-[#111827] bg-[#F0F9FF] rounded-full px-[14px] py-[7px] inline-flex mb-[14px]">
            Compliance
          </p>
          <h1
            className="text-2xl font-bold tracking-tight text-[#111827]"
            
          >
            Audit trail
          </h1>
          <p className="text-sm text-[#374151] font-normal tracking-[-0.42px] mt-[7px]">
            Tenant-scoped event history for operational, evidence, review, calculation, and report activity.
          </p>
        </div>
        <Badge variant="outline">
          {totalCount.toLocaleString("en-GB")} matching events
        </Badge>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Event filters</CardTitle>
          <CardDescription>
            Filter directly against stored audit rows. Results show the newest {PAGE_SIZE} matching events.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="grid gap-3 lg:grid-cols-[1fr_1fr_1fr_1fr_auto]" method="get">
            <Field label="Action">
              <select name="action" defaultValue={filters.action ?? ""} className={selectClass}>
                <option value="">All actions</option>
                {actionOptions.map((item) => (
                  <option key={item.action} value={item.action}>
                    {formatLabel(item.action)}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Resource">
              <select name="resource" defaultValue={filters.resource ?? ""} className={selectClass}>
                <option value="">All resources</option>
                {resourceOptions.map((item) => (
                  <option key={item.resourceType} value={item.resourceType}>
                    {formatLabel(item.resourceType)}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Actor contains">
              <Input name="actor" defaultValue={filters.actor ?? ""} placeholder="Name or email" />
            </Field>
            <Field label="Since">
              <Input name="since" type="date" defaultValue={validDate(filters.since) ?? ""} />
            </Field>
            <div className="flex items-end gap-2">
              <Button type="submit" className="w-full lg:w-auto">Apply</Button>
              <Button asChild variant="outline" className="w-full lg:w-auto">
                <a href={`/orgs/${orgId}/audit`}>Clear</a>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-base">Events</CardTitle>
          <CardDescription>
            Audit entries are append-only records created by server-side workflows.
          </CardDescription>
        </CardHeader>
        <CardContent className={logs.length === 0 ? "pb-8" : "p-0 pb-2"}>
          {logs.length === 0 ? (
            <EmptyState />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Time</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Actor</TableHead>
                  <TableHead>Resource</TableHead>
                  <TableHead>Metadata</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="whitespace-nowrap text-slate-600">
                      <time dateTime={log.createdAt.toISOString()}>
                        {log.createdAt.toLocaleString("en-GB", {
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                          month: "short",
                          year: "numeric",
                        })}
                      </time>
                    </TableCell>
                    <TableCell>
                      <Badge variant={badgeVariant(log.action)}>{formatLabel(log.action)}</Badge>
                    </TableCell>
                    <TableCell className="text-slate-600">
                      {log.actor?.name ?? log.actor?.email ?? "System"}
                    </TableCell>
                    <TableCell>
                      <div className="max-w-64">
                        <p className="font-medium text-slate-900">{formatLabel(log.resourceType)}</p>
                        <p className="truncate text-xs text-slate-500" title={log.resourceId}>
                          {log.resourceId}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <pre className="max-h-28 max-w-xl overflow-auto rounded-md bg-slate-50 p-2 text-xs leading-5 text-slate-600">
                        {formatMetadata(log.metadata)}
                      </pre>
                    </TableCell>
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

function buildAuditWhere(
  orgId: string,
  filters: Awaited<AuditPageProps["searchParams"]>,
): Prisma.AuditLogWhereInput {
  const actor = filters.actor?.trim();
  return {
    organizationId: orgId,
    ...(filters.action ? { action: filters.action } : {}),
    ...(filters.resource ? { resourceType: filters.resource } : {}),
    ...(validDate(filters.since)
      ? { createdAt: { gte: new Date(`${filters.since}T00:00:00.000Z`) } }
      : {}),
    ...(actor
      ? {
          actor: {
            OR: [
              { name: { contains: actor, mode: "insensitive" } },
              { email: { contains: actor, mode: "insensitive" } },
            ],
          },
        }
      : {}),
  };
}

function validDate(value: string | undefined) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  return Number.isNaN(new Date(`${value}T00:00:00.000Z`).getTime()) ? null : value;
}

function formatLabel(value: string) {
  return value.replace(/[._]/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatMetadata(value: unknown) {
  if (value == null || value === Prisma.JsonNull) return "{}";
  return JSON.stringify(value, null, 2);
}

function badgeVariant(action: string) {
  if (action.includes("failed") || action.includes("deleted")) return "destructive";
  if (action.includes("published") || action.includes("completed")) return "default";
  return "outline";
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <Label className="mb-1.5 block text-xs font-medium text-slate-600">{label}</Label>
      {children}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center gap-4 py-12 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#F0F9FF]">
        <Clock className="h-7 w-7 text-[#111827]" />
      </div>
      <div>
        <p className="font-normal text-[#111827] tracking-[-0.42px]">No audit events match these filters</p>
        <p className="mt-[7px] max-w-sm text-sm text-[#374151] tracking-[-0.42px]">
          Clear filters or perform an operational action to create a new audit entry.
        </p>
      </div>
    </div>
  );
}

function AccessDenied() {
  return (
    <div className="p-[42px]">
      <p className="text-sm text-[#374151] tracking-[-0.42px]">You do not have permission to view the audit trail.</p>
    </div>
  );
}

const selectClass =
  "h-9 w-full rounded-md border border-[#E5E7EB] bg-white px-3 text-sm shadow-sm disabled:cursor-not-allowed disabled:opacity-50";
