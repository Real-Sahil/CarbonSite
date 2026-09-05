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
import { Building2, GitBranch, Info } from "lucide-react";
import {
  resolveEffectiveShares,
  facilityConsolidationFactor,
  explainFacilityFactor,
  type ConsolidatableEntity,
} from "@/lib/inventory/consolidation";
import { ConsolidationApproachForm } from "./consolidation-form";
import { CreateLegalEntityForm } from "./legal-entity-form";

const APPROACH_LABEL: Record<string, string> = {
  operational_control: "Operational control",
  financial_control: "Financial control",
  equity_share: "Equity share",
};

const APPROACH_EXPLAINER: Record<string, string> = {
  operational_control:
    "Emissions are consolidated at 100% from every operation the group has authority to set operating policy for. Minority stakes the group does not run are excluded entirely.",
  financial_control:
    "Emissions are consolidated at 100% from every operation the group financially controls, meaning it directs financial and operating policy with a view to economic benefit.",
  equity_share:
    "Emissions are consolidated in proportion to the equity held. Stakes held through intermediate companies compound down the ownership chain.",
};

const EDIT_ROLES: OrgRole[] = ["admin", "sustainability_director"];

interface PageProps {
  params: Promise<{ orgId: string }>;
}

export default async function BoundaryPage({ params }: PageProps) {
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

  const [org, entities, facilities] = await Promise.all([
    prisma.organization.findUniqueOrThrow({
      where: { id: orgId },
      select: { consolidationApproach: true },
    }),
    prisma.legalEntity.findMany({
      where: { organizationId: orgId },
      orderBy: { name: "asc" },
    }),
    prisma.facility.findMany({
      where: { organizationId: orgId },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        country: true,
        siteType: true,
        floorAreaM2: true,
        headcount: true,
        legalEntityId: true,
        operationalControl: true,
        operationalFrom: true,
        operationalTo: true,
      },
    }),
  ]);

  const approach = org.consolidationApproach;

  const consolidatable: ConsolidatableEntity[] = entities.map((e) => ({
    id: e.id,
    parentId: e.parentId,
    ownershipPercent: Number(e.ownershipPercent),
    operationalControl: e.operationalControl,
    financialControl: e.financialControl,
    acquiredOn: e.acquiredOn,
    divestedOn: e.divestedOn,
  }));

  const effectiveShares = resolveEffectiveShares(approach, consolidatable);
  const today = new Date();

  const facilityRows = facilities.map((f) => {
    const args = {
      approach,
      facility: {
        id: f.id,
        legalEntityId: f.legalEntityId,
        operationalControl: f.operationalControl,
        operationalFrom: f.operationalFrom,
        operationalTo: f.operationalTo,
      },
      entities: consolidatable,
      effectiveShares,
      activityDate: today,
    };
    return {
      ...f,
      floorAreaM2: f.floorAreaM2 === null ? null : Number(f.floorAreaM2),
      factorPercent: facilityConsolidationFactor(args) * 100,
      rationale: explainFacilityFactor(args),
      entityName: entities.find((e) => e.id === f.legalEntityId)?.name ?? null,
    };
  });

  const includedCount = facilityRows.filter((f) => f.factorPercent > 0).length;
  const excludedCount = facilityRows.length - includedCount;

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-4 py-8">
      <header className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-zinc-100">
          <GitBranch className="h-5 w-5 text-zinc-700" />
        </div>
        <div>
          <h1 className="text-xl font-semibold text-zinc-900">Organisational boundary</h1>
          <p className="mt-0.5 max-w-[65ch] text-sm text-zinc-500">
            Which legal entities and facilities are consolidated into the inventory, and at what
            share. GHG Protocol Corporate Standard, chapter 3.
          </p>
        </div>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Consolidation approach</CardTitle>
          <CardDescription>
            Declared approach for this organisation. Changing it is a boundary change and is
            recorded as a structural change against the active base year.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <Badge className="bg-zinc-900 text-white hover:bg-zinc-900">
              {APPROACH_LABEL[approach]}
            </Badge>
            <p className="max-w-[65ch] text-sm leading-relaxed text-zinc-600">
              {APPROACH_EXPLAINER[approach]}
            </p>
          </div>
          {canEdit && <ConsolidationApproachForm orgId={orgId} current={approach} />}
        </CardContent>
      </Card>

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-zinc-900">Legal entities</h2>
            <p className="text-sm text-zinc-500">
              {entities.length === 0
                ? "No group structure modelled. Every facility is treated as wholly owned and directly operated."
                : `${entities.length} ${entities.length === 1 ? "entity" : "entities"} in the group.`}
            </p>
          </div>
          {canEdit && <CreateLegalEntityForm orgId={orgId} entities={entities.map((e) => ({ id: e.id, name: e.name }))} />}
        </div>

        {entities.length > 0 && (
          <Card>
            <CardContent className="overflow-x-auto p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-4">Entity</TableHead>
                    <TableHead>Parent</TableHead>
                    <TableHead className="text-right">Direct stake</TableHead>
                    <TableHead className="text-right">Effective share</TableHead>
                    <TableHead>Control</TableHead>
                    <TableHead className="pr-4">In group</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {entities.map((e) => {
                    const share = (effectiveShares.get(e.id) ?? 0) * 100;
                    const parent = entities.find((p) => p.id === e.parentId);
                    return (
                      <TableRow key={e.id}>
                        <TableCell className="pl-4">
                          <div className="font-medium text-zinc-900">{e.name}</div>
                          {e.registrationNumber && (
                            <div className="text-xs text-zinc-500">{e.registrationNumber}</div>
                          )}
                        </TableCell>
                        <TableCell className="text-sm text-zinc-500">
                          {parent?.name ?? "Top of group"}
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm tabular-nums">
                          {Number(e.ownershipPercent).toFixed(1)}%
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm font-semibold tabular-nums">
                          {share.toFixed(1)}%
                        </TableCell>
                        <TableCell className="space-x-1">
                          {e.operationalControl && (
                            <Badge variant="outline" className="text-xs">
                              Operational
                            </Badge>
                          )}
                          {e.financialControl && (
                            <Badge variant="outline" className="text-xs">
                              Financial
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="pr-4 text-sm text-zinc-500">
                          {formatWindow(e.acquiredOn, e.divestedOn)}
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

      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold text-zinc-900">Facilities in the boundary</h2>
          <p className="text-sm text-zinc-500">
            {includedCount} included, {excludedCount} excluded, assessed as at today.
          </p>
        </div>

        {facilityRows.length === 0 ? (
          <Card>
            <CardContent className="flex items-start gap-2 py-6 text-sm text-zinc-500">
              <Building2 className="mt-0.5 h-4 w-4 shrink-0" />
              No facilities recorded yet. Add facilities in settings to see how each one
              consolidates.
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="overflow-x-auto p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-4">Facility</TableHead>
                    <TableHead>Legal entity</TableHead>
                    <TableHead className="text-right">Floor area</TableHead>
                    <TableHead className="text-right">Consolidated at</TableHead>
                    <TableHead className="pr-4">Reason</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {facilityRows.map((f) => (
                    <TableRow key={f.id} className={f.factorPercent === 0 ? "opacity-60" : undefined}>
                      <TableCell className="pl-4">
                        <div className="font-medium text-zinc-900">{f.name}</div>
                        <div className="text-xs text-zinc-500">
                          {[f.siteType, f.country].filter(Boolean).join(" · ") || "No profile set"}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-zinc-500">
                        {f.entityName ?? "Unassigned"}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm tabular-nums text-zinc-600">
                        {f.floorAreaM2 === null
                          ? "not set"
                          : `${f.floorAreaM2.toLocaleString("en-GB")} m2`}
                      </TableCell>
                      <TableCell className="text-right">
                        <span
                          className={
                            f.factorPercent === 0
                              ? "font-mono text-sm font-semibold tabular-nums text-zinc-500"
                              : "font-mono text-sm font-semibold tabular-nums text-zinc-900"
                          }
                        >
                          {f.factorPercent.toFixed(1)}%
                        </span>
                      </TableCell>
                      <TableCell className="max-w-[36ch] pr-4 text-xs leading-relaxed text-zinc-500">
                        {f.rationale}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        <p className="flex items-start gap-2 text-xs leading-relaxed text-zinc-500">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          Consolidation factors are evaluated per activity date, so a facility acquired or divested
          part way through a period contributes only for the months it sat inside the boundary.
          The percentages above show the position as at today.
        </p>
      </section>
    </div>
  );
}

function formatWindow(from: Date | null, to: Date | null): string {
  if (!from && !to) return "Throughout";
  const fmt = (d: Date) =>
    d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  if (from && to) return `${fmt(from)} to ${fmt(to)}`;
  if (from) return `From ${fmt(from)}`;
  return `Until ${fmt(to!)}`;
}

function AccessDenied() {
  return (
    <div className="p-8">
      <h1 className="text-lg font-semibold text-zinc-900">Access denied</h1>
      <p className="mt-1 text-sm text-zinc-500">
        You do not have permission to view the organisational boundary.
      </p>
    </div>
  );
}
