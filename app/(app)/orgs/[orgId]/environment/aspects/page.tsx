export const dynamic = "force-dynamic";

import { AuthError, requireOrgMember, ROLE_GROUPS } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { redirect } from "next/navigation";
import type { OrgRole } from "@prisma/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AlertTriangle } from "lucide-react";
import { requiresControl, summariseAspectRegister } from "@/lib/environment/aspects";
import { CreateAspectForm } from "./aspect-form";

const MANAGE_ROLES: OrgRole[] = [
  "admin",
  "sustainability_director",
  "sustainability_manager",
  "editor",
];

interface PageProps {
  params: Promise<{ orgId: string }>;
}

export default async function AspectsPage({ params }: PageProps) {
  const { orgId } = await params;

  let role: OrgRole;
  try {
    const result = await requireOrgMember(orgId, ...ROLE_GROUPS.anyMember);
    role = result.membership.role;
  } catch (err) {
    if (err instanceof AuthError) {
      if (err.status === 401) redirect("/sign-in");
      return <Denied />;
    }
    throw err;
  }

  const canManage = MANAGE_ROLES.includes(role);

  const [aspects, facilities] = await Promise.all([
    prisma.environmentalAspect.findMany({
      where: { organizationId: orgId },
      orderBy: [{ significanceScore: "desc" }, { activity: "asc" }],
      include: { facility: { select: { name: true } } },
    }),
    prisma.facility.findMany({
      where: { organizationId: orgId },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  const summary = summariseAspectRegister(aspects);

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-zinc-900">Aspects and impacts register</h1>
          <p className="mt-0.5 max-w-[65ch] text-sm text-zinc-500">
            ISO 14001 clause 6.1.2. Each activity has an aspect that causes an impact, scored for
            severity, likelihood and legal exposure. Significant and high aspects need a
            documented control or a planned action.
          </p>
        </div>
        {canManage && <CreateAspectForm orgId={orgId} facilities={facilities} />}
      </div>

      {summary.uncontrolledSignificant > 0 && (
        <div className="flex items-start gap-3 rounded-md border border-amber-200 bg-amber-50 px-4 py-3">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
          <p className="text-sm leading-relaxed text-amber-900">
            {summary.uncontrolledSignificant} significant or high aspect
            {summary.uncontrolledSignificant === 1 ? " has" : "s have"} neither an existing control
            nor a planned action recorded. This is the finding a certification auditor raises
            first.
          </p>
        </div>
      )}

      {aspects.length === 0 ? (
        <Card>
          <CardContent className="py-6 text-sm text-zinc-500">
            No aspects recorded. Start with the activities that could cause harm if something went
            wrong: fuel storage, waste handling, discharges, plant emissions.
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="overflow-x-auto p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-4">Activity</TableHead>
                  <TableHead>Aspect and impact</TableHead>
                  <TableHead>Condition</TableHead>
                  <TableHead className="text-right">Score</TableHead>
                  <TableHead>Rating</TableHead>
                  <TableHead className="pr-4">Control</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {aspects.map((a) => {
                  const needsControl = requiresControl(a.significance);
                  const hasControl =
                    (a.existingControls?.trim().length ?? 0) > 0 ||
                    (a.furtherAction?.trim().length ?? 0) > 0;
                  return (
                    <TableRow key={a.id}>
                      <TableCell className="pl-4">
                        <div className="max-w-[26ch] font-medium leading-snug text-zinc-900">
                          {a.activity}
                        </div>
                        <div className="text-xs text-zinc-500">
                          {a.facility?.name ?? "Organisation wide"}
                        </div>
                      </TableCell>
                      <TableCell className="max-w-[34ch] text-xs leading-relaxed text-zinc-600">
                        <span className="text-zinc-900">{a.aspect}</span>
                        <span className="text-zinc-500"> causing </span>
                        {a.impact}
                      </TableCell>
                      <TableCell className="text-sm capitalize text-zinc-500">
                        {a.operatingCondition}
                      </TableCell>
                      <TableCell className="text-right">
                        <span className="font-mono text-sm tabular-nums text-zinc-900">
                          {a.significanceScore}
                        </span>
                        <div className="text-xs text-zinc-500">
                          {a.severityScore}×{a.likelihoodScore}×{a.legalScore}
                        </div>
                      </TableCell>
                      <TableCell>
                        <SignificanceBadge significance={a.significance} />
                      </TableCell>
                      <TableCell className="pr-4">
                        {!needsControl ? (
                          <span className="text-xs text-zinc-500">Not required</span>
                        ) : hasControl ? (
                          <Badge variant="outline" className="text-xs">
                            Recorded
                          </Badge>
                        ) : (
                          <Badge className="bg-amber-100 text-xs text-amber-900 hover:bg-amber-100">
                            Missing
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
    </div>
  );
}

function SignificanceBadge({ significance }: { significance: string }) {
  if (significance === "significant") {
    return <Badge className="bg-red-100 text-xs text-red-900 hover:bg-red-100">Significant</Badge>;
  }
  if (significance === "high") {
    return <Badge className="bg-amber-100 text-xs text-amber-900 hover:bg-amber-100">High</Badge>;
  }
  return (
    <Badge variant="outline" className="text-xs capitalize">
      {significance}
    </Badge>
  );
}

function Denied() {
  return (
    <div className="p-8">
      <h1 className="text-lg font-semibold text-zinc-900">Access denied</h1>
      <p className="mt-1 text-sm text-zinc-500">
        You do not have permission to view the aspects register.
      </p>
    </div>
  );
}
