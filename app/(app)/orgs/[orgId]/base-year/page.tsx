export const dynamic = "force-dynamic";

import { AuthError, requireOrgMember, ROLE_GROUPS } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { redirect } from "next/navigation";
import type { OrgRole } from "@prisma/client";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Anchor, AlertTriangle, History } from "lucide-react";
import { CreateBaseYearForm } from "./base-year-form";
import { RecordStructuralChangeForm } from "./structural-change-form";
import { ResolveRecalculationButtons } from "./recalculation-actions";

const EDIT_ROLES: OrgRole[] = ["admin", "sustainability_director"];

const CHANGE_TYPE_LABEL: Record<string, string> = {
  acquisition: "Acquisition",
  divestiture: "Divestiture",
  merger: "Merger",
  outsourcing: "Outsourcing",
  insourcing: "Insourcing",
  methodology_change: "Methodology change",
  boundary_change: "Boundary change",
  error_correction: "Error correction",
};

interface PageProps {
  params: Promise<{ orgId: string }>;
}

export default async function BaseYearPage({ params }: PageProps) {
  const { orgId } = await params;

  let role: OrgRole;
  try {
    const result = await requireOrgMember(orgId, ...ROLE_GROUPS.anyMember);
    role = result.membership.role;
  } catch (err) {
    if (err instanceof AuthError) {
      if (err.status === 401) redirect("/sign-in");
      return <AccessDenied />;
    }
    throw err;
  }

  const canEdit = EDIT_ROLES.includes(role);

  const [baseYears, changes, periods, entities, restatements] = await Promise.all([
    prisma.baseYear.findMany({
      where: { organizationId: orgId },
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
      include: {
        reportingPeriod: { select: { label: true, startDate: true, endDate: true } },
        recalculations: {
          orderBy: { createdAt: "desc" },
          include: {
            structuralChange: { select: { type: true, description: true, effectiveDate: true } },
            approvedBy: { select: { name: true, email: true } },
          },
        },
      },
    }),
    prisma.structuralChange.findMany({
      where: { organizationId: orgId },
      orderBy: { effectiveDate: "desc" },
      take: 25,
      include: {
        legalEntity: { select: { name: true } },
        recalculations: { select: { id: true, status: true, isSignificant: true } },
      },
    }),
    prisma.reportingPeriod.findMany({
      where: { organizationId: orgId },
      orderBy: { startDate: "desc" },
      select: { id: true, label: true },
    }),
    prisma.legalEntity.findMany({
      where: { organizationId: orgId },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.restatement.findMany({
      where: { organizationId: orgId },
      orderBy: { createdAt: "desc" },
      take: 25,
      include: {
        supersededSnapshot: {
          select: { version: true, reportingPeriod: { select: { label: true } } },
        },
      },
    }),
  ]);

  const active = baseYears.find((b) => b.status === "active") ?? null;

  const pendingRecalcs = baseYears
    .flatMap((b) => b.recalculations)
    .filter((r) => r.status === "awaiting_approval");

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-4 py-8">
      <header className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-zinc-100">
          <Anchor className="h-5 w-5 text-zinc-700" />
        </div>
        <div>
          <h1 className="text-xl font-semibold text-zinc-900">Base year and recalculation</h1>
          <p className="mt-0.5 max-w-[65ch] text-sm text-zinc-500">
            The reference year every target and trend is measured against, and the record of every
            structural change assessed against it. GHG Protocol Corporate Standard, chapter 5.
          </p>
        </div>
      </header>

      {pendingRecalcs.length > 0 && (
        <div className="flex items-start gap-3 rounded-md border border-amber-200 bg-amber-50 px-4 py-3">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
          <div className="text-sm text-amber-900">
            <p className="font-medium">
              {pendingRecalcs.length} recalculation
              {pendingRecalcs.length === 1 ? "" : "s"} awaiting approval
            </p>
            <p className="mt-0.5 leading-relaxed text-amber-800">
              A structural change moved the base year by more than the significance threshold.
              Until this is resolved, published trends compare against a superseded baseline.
            </p>
          </div>
        </div>
      )}

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-zinc-900">Base years</h2>
            <p className="text-sm text-zinc-500">
              {active
                ? `Active baseline: ${active.label}.`
                : "No active base year. Targets and trends have nothing to measure against."}
            </p>
          </div>
          {canEdit && <CreateBaseYearForm orgId={orgId} periods={periods} />}
        </div>

        {baseYears.length === 0 ? (
          <EmptyCard text="No base year declared yet. Declare one to anchor your targets and trend lines." />
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {baseYears.map((by) => {
              const original = Number(by.originalTotalCo2e ?? 0);
              const current = Number(by.currentTotalCo2e ?? 0);
              const drift = original !== 0 ? ((current - original) / original) * 100 : null;
              return (
                <Card key={by.id}>
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <CardTitle className="text-base">{by.label}</CardTitle>
                        <CardDescription>{by.reportingPeriod.label}</CardDescription>
                      </div>
                      <StatusBadge status={by.status} />
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <Row label="As first published" value={`${original.toFixed(2)} tCO2e`} />
                    <Row label="After recalculations" value={`${current.toFixed(2)} tCO2e`} />
                    <Row
                      label="Cumulative drift"
                      value={drift === null ? "not applicable" : `${drift.toFixed(2)}%`}
                      emphasis={drift !== null && Math.abs(drift) >= Number(by.significanceThresholdPercent)}
                    />
                    <Row
                      label="Significance threshold"
                      value={`${Number(by.significanceThresholdPercent).toFixed(1)}%`}
                    />
                    {by.rationale && (
                      <p className="pt-1 text-xs leading-relaxed text-zinc-500">{by.rationale}</p>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-zinc-900">Structural changes</h2>
            <p className="max-w-[65ch] text-sm text-zinc-500">
              Every acquisition, divestiture, outsourcing decision, methodology change and error
              correction. Each one is assessed against the active base year when it is recorded.
            </p>
          </div>
          {canEdit && <RecordStructuralChangeForm orgId={orgId} entities={entities} />}
        </div>

        {changes.length === 0 ? (
          <EmptyCard text="No structural changes recorded. Organic growth and decline do not belong here." />
        ) : (
          <Card>
            <CardContent className="overflow-x-auto p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-4">Change</TableHead>
                    <TableHead>Effective</TableHead>
                    <TableHead>Entity</TableHead>
                    <TableHead className="pr-4">Assessment</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {changes.map((c) => {
                    const recalc = c.recalculations[0];
                    return (
                      <TableRow key={c.id}>
                        <TableCell className="pl-4">
                          <div className="font-medium text-zinc-900">
                            {CHANGE_TYPE_LABEL[c.type] ?? c.type}
                          </div>
                          <div className="max-w-[44ch] text-xs leading-relaxed text-zinc-500">
                            {c.description}
                          </div>
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-sm text-zinc-500">
                          {formatDate(c.effectiveDate)}
                        </TableCell>
                        <TableCell className="text-sm text-zinc-500">
                          {c.legalEntity?.name ?? "Group wide"}
                        </TableCell>
                        <TableCell className="pr-4">
                          {!recalc ? (
                            <span className="text-xs text-zinc-500">No active base year</span>
                          ) : recalc.status === "not_significant" ? (
                            <Badge variant="outline" className="text-xs">
                              Below threshold
                            </Badge>
                          ) : recalc.status === "awaiting_approval" ? (
                            <Badge className="bg-amber-100 text-xs text-amber-900 hover:bg-amber-100">
                              Awaiting approval
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-xs capitalize">
                              {recalc.status}
                            </Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </section>

      {baseYears.some((b) => b.recalculations.length > 0) && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-zinc-900">Recalculation history</h2>
          <Card>
            <CardContent className="overflow-x-auto p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-4">Trigger</TableHead>
                    <TableHead className="text-right">Before</TableHead>
                    <TableHead className="text-right">After</TableHead>
                    <TableHead className="text-right">Change</TableHead>
                    <TableHead>Status</TableHead>
                    {canEdit && <TableHead className="pr-4">Action</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {baseYears.flatMap((by) =>
                    by.recalculations.map((r) => {
                      const delta = r.deltaPercent === null ? null : Number(r.deltaPercent);
                      return (
                        <TableRow key={r.id}>
                          <TableCell className="pl-4">
                            <div className="font-medium text-zinc-900">
                              {CHANGE_TYPE_LABEL[r.structuralChange.type] ?? r.structuralChange.type}
                            </div>
                            <div className="text-xs text-zinc-500">{by.label}</div>
                          </TableCell>
                          <TableCell className="text-right font-mono text-sm tabular-nums">
                            {Number(r.previousTotalCo2e ?? 0).toFixed(2)}
                          </TableCell>
                          <TableCell className="text-right font-mono text-sm tabular-nums">
                            {Number(r.restatedTotalCo2e ?? 0).toFixed(2)}
                          </TableCell>
                          <TableCell
                            className={
                              r.isSignificant
                                ? "text-right font-mono text-sm font-semibold tabular-nums text-amber-700"
                                : "text-right font-mono text-sm tabular-nums text-zinc-500"
                            }
                          >
                            {delta === null ? "n/a" : `${delta > 0 ? "+" : ""}${delta.toFixed(2)}%`}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-xs capitalize">
                              {r.status.replace(/_/g, " ")}
                            </Badge>
                          </TableCell>
                          {canEdit && (
                            <TableCell className="pr-4">
                              {r.status === "awaiting_approval" ? (
                                <ResolveRecalculationButtons orgId={orgId} recalculationId={r.id} />
                              ) : (
                                <span className="text-xs text-zinc-500">
                                  {r.approvedBy
                                    ? (r.approvedBy.name ?? r.approvedBy.email)
                                    : "No action needed"}
                                </span>
                              )}
                            </TableCell>
                          )}
                        </TableRow>
                      );
                    }),
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </section>
      )}

      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold text-zinc-900">Restatement register</h2>
          <p className="max-w-[65ch] text-sm text-zinc-500">
            Published figures that have since been corrected. Frameworks require material
            restatements to be disclosed with the reason and the magnitude.
          </p>
        </div>

        {restatements.length === 0 ? (
          <EmptyCard text="No restatements recorded. Published figures stand as first issued." />
        ) : (
          <Card>
            <CardContent className="overflow-x-auto p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-4">Period</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead className="text-right">Change</TableHead>
                    <TableHead className="pr-4">Disclosure</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {restatements.map((r) => {
                    const delta = r.deltaPercent === null ? null : Number(r.deltaPercent);
                    return (
                      <TableRow key={r.id}>
                        <TableCell className="pl-4">
                          <div className="font-medium text-zinc-900">
                            {r.supersededSnapshot.reportingPeriod.label}
                          </div>
                          <div className="text-xs text-zinc-500">
                            Snapshot v{r.supersededSnapshot.version}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm capitalize text-zinc-700">
                            {r.reason.replace(/_/g, " ")}
                          </div>
                          <div className="max-w-[40ch] text-xs leading-relaxed text-zinc-500">
                            {r.description}
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm tabular-nums">
                          {delta === null ? "n/a" : `${delta > 0 ? "+" : ""}${delta.toFixed(2)}%`}
                        </TableCell>
                        <TableCell className="pr-4">
                          {r.isMaterial ? (
                            <Badge className="bg-amber-100 text-xs text-amber-900 hover:bg-amber-100">
                              Must be disclosed
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-xs">
                              Below materiality
                            </Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </section>
    </div>
  );
}

function Row({
  label,
  value,
  emphasis,
}: {
  label: string;
  value: string;
  emphasis?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-zinc-500">{label}</span>
      <span
        className={
          emphasis
            ? "font-mono font-semibold tabular-nums text-amber-700"
            : "font-mono tabular-nums text-zinc-900"
        }
      >
        {value}
      </span>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  if (status === "active") {
    return (
      <Badge className="bg-green-100 text-xs text-green-900 hover:bg-green-100">Active</Badge>
    );
  }
  if (status === "superseded") {
    return (
      <Badge variant="outline" className="text-xs text-zinc-500">
        Superseded
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="text-xs">
      Draft
    </Badge>
  );
}

function EmptyCard({ text }: { text: string }) {
  return (
    <Card>
      <CardContent className="flex items-start gap-2 py-6 text-sm text-zinc-500">
        <History className="mt-0.5 h-4 w-4 shrink-0" />
        {text}
      </CardContent>
    </Card>
  );
}

function formatDate(d: Date): string {
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function AccessDenied() {
  return (
    <div className="p-8">
      <h1 className="text-lg font-semibold text-zinc-900">Access denied</h1>
      <p className="mt-1 text-sm text-zinc-500">
        You do not have permission to view the base year register.
      </p>
    </div>
  );
}
