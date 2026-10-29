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
import { EventDetail } from "./event-detail";
import { MAX_OFFSET, pageHref, wholeNumberParam } from "@/lib/api/pagination";

interface AuditPageProps {
  params: Promise<{ orgId: string }>;
  searchParams: Promise<{
    action?: string;
    actor?: string;
    resource?: string;
    since?: string;
    until?: string;
    offset?: string;
    limit?: string;
    before?: string;
    after?: string;
  }>;
}

const PAGE_SIZES = [25, 50, 100] as const;
const DEFAULT_SIZE = 25;
// The filter dropdowns list the actions and resource types written in the last year. Over the whole
// trail, each DISTINCT scan grew with every row ever written, on every page load. A selected value
// older than the window is still offered, so the filter keeps what the person chose.
const OPTIONS_WINDOW_MS = 365 * 86_400_000;

export default async function AuditPage({ params, searchParams }: AuditPageProps) {
  const { orgId } = await params;
  const filters = await searchParams;
  // A malformed offset is 0, not NaN: NaN reaches Prisma as skip and fails the whole load.
  const requested = wholeNumberParam(filters.limit, DEFAULT_SIZE, 1, 100);
  const PAGE_SIZE = (PAGE_SIZES as readonly number[]).includes(requested) ? requested : DEFAULT_SIZE;
  // Snap a hand-edited offset to a page boundary so page links and "Page N of M" stay consistent.
  const offset = Math.floor(wholeNumberParam(filters.offset, 0, 0, MAX_OFFSET) / PAGE_SIZE) * PAGE_SIZE;

  let authErr: AuthError | null = null;
  let canVerify = false;
  let canExport = false;
  try {
    const { membership } = await requireOrgMember(orgId, ...ROLE_GROUPS.dataReaders);
    canExport = ["admin", "auditor"].includes(membership.role);
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
  // Next and Previous page by chain number, not by skipping rows, so a deep page costs the same as the first
  // and new events arriving do not shift the page under the reader. Page numbers and Last still use the offset.
  const before = seqParam(filters.before);
  const after = seqParam(filters.after);
  const cursorWhere: Prisma.AuditLogWhereInput = {
    ...where,
    ...(before !== null ? { chainSeq: { lt: before } } : after !== null ? { chainSeq: { gt: after } } : {}),
  };
  const useCursor = before !== null || after !== null;
  const optionsSince = new Date(Date.now() - OPTIONS_WINDOW_MS);
  const dbResult = await Promise.all([
    prisma.auditLog.findMany({
      where: cursorWhere,
      select: {
        id: true,
        createdAt: true,
        action: true,
        resourceType: true,
        resourceId: true,
        metadata: true,
        ipAddress: true,
        userAgent: true,
        chainSeq: true,
        hashVersion: true,
        redactedAt: true,
        actor: { select: { name: true, email: true } },
      },
      orderBy: { chainSeq: after !== null ? "asc" : "desc" },
      ...(useCursor ? {} : { skip: offset }),
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
  const [fetched, actionRows, resourceRows, totalCount] = dbResult;
  const logs = after !== null ? [...fetched].reverse() : fetched;
  const actionOptions =
    filters.action && !actionRows.some((row) => row.action === filters.action)
      ? [...actionRows, { action: filters.action }].sort((a, b) => a.action.localeCompare(b.action))
      : actionRows;
  const resourceOptions =
    filters.resource && !resourceRows.some((row) => row.resourceType === filters.resource)
      ? [...resourceRows, { resourceType: filters.resource }].sort((a, b) => a.resourceType.localeCompare(b.resourceType))
      : resourceRows;
  const pageCount = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const currentPage = Math.floor(offset / PAGE_SIZE) + 1;
  const presets = [
    { label: "24 hours", days: 1 },
    { label: "7 days", days: 7 },
    { label: "30 days", days: 30 },
  ];
  const presetHref = (days: number) =>
    pageHref(`/orgs/${orgId}/audit`, {
      action: filters.action,
      resource: filters.resource,
      actor: filters.actor,
      since: new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10),
    });
  // The export route has no actor filter, so the link says nothing about one; it carries the rest.
  const exportHref = pageHref(`/api/orgs/${orgId}/audit-logs/export`, {
    action: filters.action,
    resourceType: filters.resource,
    actor: filters.actor?.trim() || undefined,
    from: validDate(filters.since) ? `${filters.since}T00:00:00.000Z` : undefined,
    to: validDate(filters.until) ? `${filters.until}T23:59:59.999Z` : undefined,
  });
  const newest = logs[0]?.chainSeq.toString();
  const oldest = logs[logs.length - 1]?.chainSeq.toString();
  const hrefFor = (nextOffset: number, size: number, cursor?: { before?: string; after?: string }) =>
    pageHref(`/orgs/${orgId}/audit`, {
      ...cursor,
      action: filters.action,
      resource: filters.resource,
      actor: filters.actor,
      since: filters.since,
      until: filters.until,
      limit: size === DEFAULT_SIZE ? undefined : size,
      offset: Math.max(0, nextOffset) || undefined,
    });

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
              Filter directly against stored audit rows.
            </CardDescription>
          </CardHeader>
          <CardContent className="px-6 py-5">
            <form className="grid gap-3 lg:grid-cols-[1fr_1fr_1fr_1fr_1fr_auto]" method="get">
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
              <Field label="Until">
                <Input name="until" type="date" defaultValue={validDate(filters.until) ?? ""} />
              </Field>
              <div className="flex items-end gap-2">
                <input type="hidden" name="limit" value={PAGE_SIZE} />
                <Button type="submit" className="w-full lg:w-auto">Apply</Button>
                <Button asChild variant="outline" className="w-full lg:w-auto border-[#E3E8EE] text-[#41505F]">
                  <a href={`/orgs/${orgId}/audit`}>Clear</a>
                </Button>
              </div>
            </form>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-[#5B6A78]">
              <span>Quick range</span>
              {presets.map((preset) => (
                <a key={preset.label} href={presetHref(preset.days)} className="rounded-md border border-[#E3E8EE] px-2 py-1 text-[#41505F] hover:bg-[#F9FAFC]">
                  {preset.label}
                </a>
              ))}
              {canExport && (
                <a href={exportHref} className="ml-auto rounded-md border border-[#E3E8EE] px-2 py-1 text-[#41505F] hover:bg-[#F9FAFC]">
                  Export CSV
                </a>
              )}
            </div>
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
                        <TableHead className="text-xs font-medium text-[#5B6A78] py-3">Chain</TableHead>
                        <TableHead className="text-xs font-medium text-[#5B6A78] py-3">Metadata</TableHead>
                        <TableHead className="text-xs font-medium text-[#5B6A78] py-3 pr-6"><span className="sr-only">Open</span></TableHead>
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
                          <TableCell className="py-3.5">
                            <p className="text-xs tabular-nums text-[#41505F]">#{log.chainSeq.toString()}</p>
                            <p className="text-xs text-[#5B6A78]">
                              {log.redactedAt ? "Redacted" : log.hashVersion === 2 ? "Recomputable" : "Links only"}
                            </p>
                          </TableCell>
                          <TableCell className="py-3.5">
                            <MetadataCell value={log.metadata} ipAddress={log.ipAddress} userAgent={log.userAgent} />
                          </TableCell>
                          <TableCell className="py-3.5 pr-6">
                            <EventDetail
                              time={log.createdAt.toISOString()}
                              action={formatLabel(log.action)}
                              actor={log.actor?.name ?? log.actor?.email ?? "System"}
                              resourceType={formatLabel(log.resourceType)}
                              resourceId={log.resourceId}
                              chain={`#${log.chainSeq.toString()}, ${log.redactedAt ? "redacted" : log.hashVersion === 2 ? "recomputable" : "links only"}`}
                              ipAddress={log.ipAddress}
                              userAgent={log.userAgent}
                              metadata={formatMetadata(log.metadata)}
                            />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                <div className="border-t border-[#E3E8EE] px-4 py-4 sm:px-6 flex flex-wrap items-center justify-between gap-3">
                  <p className="text-xs text-[#41505F]">
                    Showing {(offset + 1).toLocaleString("en-GB")} to {Math.min(offset + PAGE_SIZE, totalCount).toLocaleString("en-GB")} of {totalCount.toLocaleString("en-GB")} events
                  </p>
                  <nav aria-label="Audit trail pages" className="flex flex-wrap items-center gap-2">
                    <span className="text-xs text-[#5B6A78]">Per page</span>
                    {PAGE_SIZES.map((size) => (
                      <a
                        key={size}
                        href={hrefFor(0, size)}
                        aria-current={size === PAGE_SIZE ? "true" : undefined}
                        className={`inline-flex h-8 min-w-8 items-center justify-center rounded-md border px-2 text-xs ${size === PAGE_SIZE ? "border-[#131d29] bg-[#131d29] text-white" : "border-[#E3E8EE] text-[#41505F] hover:bg-[#F9FAFC]"}`}
                      >
                        {size}
                      </a>
                    ))}
                    <span className="mx-1 h-4 w-px bg-[#E3E8EE]" aria-hidden="true" />
                    <PageLink href={currentPage > 1 ? hrefFor(0, PAGE_SIZE) : null}>First</PageLink>
                    <PageLink href={currentPage > 1 ? hrefFor(offset - PAGE_SIZE, PAGE_SIZE, { after: newest }) : null}>Previous</PageLink>
                    <span className="px-1 text-xs text-[#41505F]">Page {currentPage} of {pageCount}</span>
                    <PageLink href={currentPage < pageCount ? hrefFor(offset + PAGE_SIZE, PAGE_SIZE, { before: oldest }) : null}>Next</PageLink>
                    <PageLink href={currentPage < pageCount ? hrefFor((pageCount - 1) * PAGE_SIZE, PAGE_SIZE) : null}>Last</PageLink>
                  </nav>
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
    ...(validDate(filters.since) || validDate(filters.until)
      ? {
          createdAt: {
            ...(validDate(filters.since) ? { gte: new Date(`${filters.since}T00:00:00.000Z`) } : {}),
            // "Until" includes the whole chosen day.
            ...(validDate(filters.until) ? { lte: new Date(`${filters.until}T23:59:59.999Z`) } : {}),
          },
        }
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

function seqParam(value: string | undefined): bigint | null {
  return value && /^\d{1,18}$/.test(value) ? BigInt(value) : null;
}

function validDate(value: string | undefined) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  return Number.isNaN(new Date(`${value}T00:00:00.000Z`).getTime()) ? null : value;
}

function formatLabel(value: string) {
  return value.replace(/[._]/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function PageLink({ href, children }: { href: string | null; children: React.ReactNode }) {
  if (!href) return <Button variant="outline" size="sm" disabled className="opacity-50">{children}</Button>;
  return (
    <Button asChild variant="outline" size="sm">
      <a href={href}>{children}</a>
    </Button>
  );
}

// Metadata is collapsed by default: a full JSON block on every row made each page very long.
function MetadataCell({ value, ipAddress, userAgent }: { value: unknown; ipAddress: string | null; userAgent: string | null }) {
  const text = formatMetadata(value);
  if (text === "{}" && !ipAddress && !userAgent) return <span className="text-xs text-[#5B6A78]">None</span>;
  const keys = value && typeof value === "object" ? Object.keys(value as object).length : 0;
  return (
    <details className="max-w-xl">
      <summary className="cursor-pointer text-xs text-[#41505F]">
        {keys > 0 ? `${keys} ${keys === 1 ? "field" : "fields"}` : "Details"}
      </summary>
      {(ipAddress || userAgent) && (
        <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs text-[#41505F]">
          {ipAddress && (<><dt className="text-[#5B6A78]">IP address</dt><dd>{ipAddress}</dd></>)}
          {userAgent && (<><dt className="text-[#5B6A78]">Browser</dt><dd className="break-all">{userAgent}</dd></>)}
        </dl>
      )}
      <pre className="mt-2 max-h-48 overflow-auto rounded-md bg-[#F9FAFC] border border-[#E3E8EE] p-2 text-xs leading-5 text-[#41505F]">
        {text}
      </pre>
    </details>
  );
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
