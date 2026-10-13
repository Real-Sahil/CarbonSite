export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { Clock } from "lucide-react";
import { Prisma } from "@prisma/client";
import { AuthError, requireOrgMember, ROLE_GROUPS } from "@/lib/auth/session";
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
import { EmptyState as EmptyPanel } from "@/components/ui/empty-state";
import { VerifyChain } from "./verify-chain";
import { MAX_OFFSET, pageHref, wholeNumberParam } from "@/lib/api/pagination";

interface AuditPageProps {
  params: Promise<{ orgId: string }>;
  searchParams: Promise<{
    action?: string;
    actor?: string;
    resource?: string;
    since?: string;
    offset?: string;
  }>;
}

const PAGE_SIZE = 100;
// The filter dropdowns list the actions and resource types written in the last year. Over the whole
// trail, each DISTINCT scan grew with every row ever written, on every page load. A selected value
// older than the window is still offered, so the filter keeps what the person chose.
const OPTIONS_WINDOW_MS = 365 * 86_400_000;

export default async function AuditPage({ params, searchParams }: AuditPageProps) {
  const { orgId } = await params;
  const filters = await searchParams;
  // A malformed offset is 0, not NaN: NaN reaches Prisma as skip and fails the whole load.
  const offset = wholeNumberParam(filters.offset, 0, 0, MAX_OFFSET);

  let authErr: AuthError | null = null;
  let canVerify = false;
  try {
    const { membership } = await requireOrgMember(orgId, ...ROLE_GROUPS.dataReaders);
    canVerify = ["admin", "sustainability_director", "sustainability_manager", "reviewer", "auditor"].includes(membership.role);
  } catch (err) {
    if (err instanceof AuthError) {
      authErr = err;
    } else {
      return (
        <div className="p-8">
          <p className="text-red-600 text-sm">
            Failed to load page. The database may be updating — try refreshing in a moment.
          </p>
        </div>
      );
    }
  }
  // redirect() must be called outside try/catch — it throws NEXT_REDIRECT internally
  if (authErr) {
    if (authErr.status === 401) redirect("/sign-in");
    return <AccessDenied />;
  }

  const where = buildAuditWhere(orgId, filters);
  const optionsSince = new Date(Date.now() - OPTIONS_WINDOW_MS);
  const dbResult = await Promise.all([
    prisma.auditLog.findMany({
      where,
      select: {
        id: true,
        createdAt: true,
        action: true,
        resourceType: true,
        resourceId: true,
        metadata: true,
        actor: { select: { name: true, email: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: offset,
      take: PAGE_SIZE,
    }),
    prisma.auditLog.findMany({
      where: { organizationId: orgId, createdAt: { gte: optionsSince } },
      distinct: ["action"],
      select: { action: true },
      orderBy: { action: "asc" },
    }),
    prisma.auditLog.findMany({
      where: { organizationId: orgId, createdAt: { gte: optionsSince } },
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
  const [logs, actionRows, resourceRows, totalCount] = dbResult;
  const actionOptions =
    filters.action && !actionRows.some((row) => row.action === filters.action)
      ? [...actionRows, { action: filters.action }].sort((a, b) => a.action.localeCompare(b.action))
      : actionRows;
  const resourceOptions =
    filters.resource && !resourceRows.some((row) => row.resourceType === filters.resource)
      ? [...resourceRows, { resourceType: filters.resource }].sort((a, b) => a.resourceType.localeCompare(b.resourceType))
      : resourceRows;
  const pageCount = Math.ceil(totalCount / PAGE_SIZE);
  const currentPage = Math.floor(offset / PAGE_SIZE) + 1;

  return (
    <div className="min-h-[100dvh] bg-[#F9FAFC]">
      {/* Page header */}
      <div className="bg-white border-b border-[#E3E8EE]">
        <div className="max-w-[1200px] mx-auto px-4 sm:px-8 py-8">
          <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#FFF7ED]">
                  <Clock className="h-4 w-4 text-[#131d29]" />
                </div>
                <span className="text-xs font-medium tracking-wide text-[#131d29] uppercase">
                  Compliance
                </span>
              </div>
              <h1 className="text-2xl tracking-tight text-[#131d29]">
                Audit trail
              </h1>
              <p className="mt-1 text-sm text-[#41505F] max-w-[65ch]">
                Tenant-scoped event history for operational, evidence, review, calculation, and report activity.
              </p>
            </div>
            <Badge variant="outline" className="shrink-0 self-start text-[#41505F] border-[#E3E8EE]">
              {totalCount.toLocaleString("en-GB")} matching events
            </Badge>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-[1200px] mx-auto px-4 sm:px-8 py-8 flex flex-col gap-6">
        {canVerify && <VerifyChain orgId={orgId} />}
        <Card className="border-[#E3E8EE] shadow-none">
          <CardHeader className="px-6 py-4 border-b border-[#E3E8EE]">
            <CardTitle className="text-sm font-semibold text-[#131d29]">Event filters</CardTitle>
            <CardDescription className="text-xs text-[#5B6A78] mt-0.5">
              Filter directly against stored audit rows. Page size: {PAGE_SIZE} events per page.
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
                <Button type="submit" className="w-full lg:w-auto">Apply</Button>
                <Button asChild variant="outline" className="w-full lg:w-auto border-[#E3E8EE] text-[#41505F]">
                  <a href={`/orgs/${orgId}/audit`}>Clear</a>
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card className="border-[#E3E8EE] shadow-none">
          <CardHeader className="px-6 py-4 border-b border-[#E3E8EE]">
            <CardTitle className="text-sm font-semibold text-[#131d29]">Events</CardTitle>
            <CardDescription className="text-xs text-[#5B6A78] mt-0.5">
              Audit entries are append-only records created by server-side workflows.
            </CardDescription>
          </CardHeader>
          <CardContent className={logs.length === 0 ? "pb-8" : "p-0"}>
            {logs.length === 0 ? (
              <EmptyState />
            ) : (
              <>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-[#F9FAFC] border-b border-[#E3E8EE]">
                        <TableHead className="text-xs font-medium text-[#5B6A78] py-3 pl-6">Time</TableHead>
                        <TableHead className="text-xs font-medium text-[#5B6A78] py-3">Action</TableHead>
                        <TableHead className="text-xs font-medium text-[#5B6A78] py-3">Actor</TableHead>
                        <TableHead className="text-xs font-medium text-[#5B6A78] py-3">Resource</TableHead>
                        <TableHead className="text-xs font-medium text-[#5B6A78] py-3 pr-6">Metadata</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {logs.map((log) => (
                        <TableRow key={log.id} className="border-b border-[#E3E8EE] hover:bg-[#F9FAFC] transition-colors">
                          <TableCell className="whitespace-nowrap text-sm text-[#5B6A78] tabular-nums py-3.5 pl-6">
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
                          <TableCell className="text-sm text-[#41505F] py-3.5">
                            {log.actor?.name ?? log.actor?.email ?? "System"}
                          </TableCell>
                          <TableCell className="py-3.5">
                            <div className="max-w-64">
                              <p className="text-sm font-medium text-[#131d29]">{formatLabel(log.resourceType)}</p>
                              <p className="truncate text-xs text-[#5B6A78]" title={log.resourceId}>
                                {log.resourceId}
                              </p>
                            </div>
                          </TableCell>
                          <TableCell className="py-3.5 pr-6">
                            <pre className="max-h-28 max-w-xl overflow-auto rounded-md bg-[#F9FAFC] border border-[#E3E8EE] p-2 text-xs leading-5 text-[#41505F]">
                              {formatMetadata(log.metadata)}
                            </pre>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                <div className="border-t border-[#E3E8EE] px-6 py-4 flex items-center justify-between">
                  <div className="text-xs text-[#41505F]">
                    Page {currentPage} of {pageCount} ({totalCount.toLocaleString("en-GB")} total events)
                  </div>
                  <div className="flex gap-2">
                    {offset === 0 ? (
                      <Button variant="outline" disabled className="opacity-50 cursor-not-allowed">
                        Previous
                      </Button>
                    ) : (
                      <Button asChild variant="outline">
                        <a href={pageHref(`/orgs/${orgId}/audit`, { action: filters.action, resource: filters.resource, actor: filters.actor, since: filters.since, offset: Math.max(0, offset - PAGE_SIZE) || undefined })}>
                          Previous
                        </a>
                      </Button>
                    )}
                    {offset + PAGE_SIZE >= totalCount ? (
                      <Button variant="outline" disabled className="opacity-50 cursor-not-allowed">
                        Next
                      </Button>
                    ) : (
                      <Button asChild variant="outline">
                        <a href={pageHref(`/orgs/${orgId}/audit`, { action: filters.action, resource: filters.resource, actor: filters.actor, since: filters.since, offset: offset + PAGE_SIZE })}>
                          Next
                        </a>
                      </Button>
                    )}
                  </div>
                </div>
              </>
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
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return "{}";
  }
}

function badgeVariant(action: string) {
  if (action.includes("failed") || action.includes("deleted")) return "destructive";
  if (action.includes("published") || action.includes("completed")) return "default";
  return "outline";
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <Label className="mb-1.5 block text-xs font-medium text-[#41505F]">{label}</Label>
      {children}
    </div>
  );
}

function EmptyState() {
  return (
    <EmptyPanel
      icon={Clock}
      title="No audit events match these filters"
      description="Clear the filters or perform an operational action to create a new audit entry."
    />
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
  "h-9 w-full rounded-md border border-[#E3E8EE] bg-white px-3 text-sm shadow-sm disabled:cursor-not-allowed disabled:opacity-50";
