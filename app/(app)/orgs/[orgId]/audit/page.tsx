export const dynamic = "force-dynamic";

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
    return (
      <div className="p-8">
        <p className="text-red-600 text-sm">
          Failed to load page. The database may be updating — try refreshing in a moment.
        </p>
      </div>
    );
  }

  const where = buildAuditWhere(orgId, filters);
  const dbResult = await Promise.all([
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
  ]).catch(() => null);

  if (!dbResult) {
    return (
      <div className="p-8"><p className="text-red-600 text-sm">Failed to load audit logs. The database may be updating — try refreshing in a moment.</p></div>
    );
  }
  const [logs, actionOptions, resourceOptions, totalCount] = dbResult;

  return (
    <div className="min-h-[100dvh] bg-[#F9FAFB]">
      {/* Page header */}
      <div className="bg-white border-b border-[#E5E7EB]">
        <div className="max-w-[1200px] mx-auto px-8 py-8">
          <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#F0F9FF]">
                  <Clock className="h-4 w-4 text-[#111827]" />
                </div>
                <span className="text-xs font-medium tracking-wide text-[#111827] uppercase">
                  Compliance
                </span>
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-[#111827]">
                Audit trail
              </h1>
              <p className="mt-1 text-sm text-[#374151] max-w-[65ch]">
                Tenant-scoped event history for operational, evidence, review, calculation, and report activity.
              </p>
            </div>
            <Badge variant="outline" className="shrink-0 self-start text-[#374151] border-[#E5E7EB]">
              {totalCount.toLocaleString("en-GB")} matching events
            </Badge>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-[1200px] mx-auto px-8 py-8 flex flex-col gap-6">
        <Card className="border-[#E5E7EB] shadow-none">
          <CardHeader className="px-6 py-4 border-b border-[#E5E7EB]">
            <CardTitle className="text-sm font-semibold text-[#111827]">Event filters</CardTitle>
            <CardDescription className="text-xs text-[#9CA3AF] mt-0.5">
              Filter directly against stored audit rows. Results show the newest {PAGE_SIZE} matching events.
            </CardDescription>
          </CardHeader>
          <CardContent className="px-6 py-5">
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
                <Button type="submit" className="w-full lg:w-auto bg-[#f97316] hover:bg-[#ea580c] text-white">Apply</Button>
                <Button asChild variant="outline" className="w-full lg:w-auto border-[#E5E7EB] text-[#374151]">
                  <a href={`/orgs/${orgId}/audit`}>Clear</a>
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card className="border-[#E5E7EB] shadow-none">
          <CardHeader className="px-6 py-4 border-b border-[#E5E7EB]">
            <CardTitle className="text-sm font-semibold text-[#111827]">Events</CardTitle>
            <CardDescription className="text-xs text-[#9CA3AF] mt-0.5">
              Audit entries are append-only records created by server-side workflows.
            </CardDescription>
          </CardHeader>
          <CardContent className={logs.length === 0 ? "pb-8" : "p-0"}>
            {logs.length === 0 ? (
              <EmptyState />
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-[#F9FAFB] border-b border-[#E5E7EB]">
                      <TableHead className="text-xs font-medium text-[#9CA3AF] py-3 pl-6">Time</TableHead>
                      <TableHead className="text-xs font-medium text-[#9CA3AF] py-3">Action</TableHead>
                      <TableHead className="text-xs font-medium text-[#9CA3AF] py-3">Actor</TableHead>
                      <TableHead className="text-xs font-medium text-[#9CA3AF] py-3">Resource</TableHead>
                      <TableHead className="text-xs font-medium text-[#9CA3AF] py-3 pr-6">Metadata</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {logs.map((log) => (
                      <TableRow key={log.id} className="border-b border-[#F3F4F6] hover:bg-[#F9FAFB] transition-colors">
                        <TableCell className="whitespace-nowrap text-sm text-[#9CA3AF] tabular-nums py-3.5 pl-6">
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
                        <TableCell className="py-3.5">
                          <Badge variant={badgeVariant(log.action)}>{formatLabel(log.action)}</Badge>
                        </TableCell>
                        <TableCell className="text-sm text-[#374151] py-3.5">
                          {log.actor?.name ?? log.actor?.email ?? "System"}
                        </TableCell>
                        <TableCell className="py-3.5">
                          <div className="max-w-64">
                            <p className="text-sm font-medium text-[#111827]">{formatLabel(log.resourceType)}</p>
                            <p className="truncate text-xs text-[#9CA3AF]" title={log.resourceId}>
                              {log.resourceId}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell className="py-3.5 pr-6">
                          <pre className="max-h-28 max-w-xl overflow-auto rounded-md bg-[#F9FAFB] border border-[#E5E7EB] p-2 text-xs leading-5 text-[#374151]">
                            {formatMetadata(log.metadata)}
                          </pre>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
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
      <Label className="mb-1.5 block text-xs font-medium text-[#374151]">{label}</Label>
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
    <div className="p-8">
      <p className="text-sm text-red-600">You do not have permission to view the audit trail.</p>
    </div>
  );
}

const selectClass =
  "h-9 w-full rounded-md border border-[#E5E7EB] bg-white px-3 text-sm shadow-sm disabled:cursor-not-allowed disabled:opacity-50";
