export const dynamic = "force-dynamic";

import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { CheckCircle2, CircleAlert, XCircle } from "lucide-react";
import { AuthError, requireOrgMember, ROLE_GROUPS } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { HIERARCHY, ROLE_LABELS } from "@/lib/pas2080";
import { loadPas2080 } from "@/lib/pas2080/load";
import { PAS2080_EDITORS } from "@/lib/pas2080/roles";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { OpportunityLog, PlanForm } from "./pas2080-actions";

interface Props {
  params: Promise<{ orgId: string; contractId: string; projectId: string }>;
}

const t = (n: number | null | undefined) =>
  n == null ? "Not set" : `${n.toLocaleString("en-GB", { maximumFractionDigits: 1 })} tCO₂e`;

export default async function Pas2080Page({ params }: Props) {
  const { orgId, contractId, projectId } = await params;

  let role;
  try {
    role = (await requireOrgMember(orgId, ...ROLE_GROUPS.anyMember)).membership.role;
  } catch (err) {
    if (err instanceof AuthError && err.status === 401) redirect("/sign-in");
    if (err instanceof AuthError) notFound();
    throw err;
  }
  const canEdit = PAS2080_EDITORS.includes(role);

  const project = await prisma.project.findFirst({
    where: { id: projectId, contractId, organizationId: orgId },
    select: { name: true, contract: { select: { name: true } } },
  });
  if (!project) notFound();

  const { plan, opportunities, position, checks, measured } = await loadPas2080(orgId, projectId);
  const base = `/orgs/${orgId}/contracts/${contractId}/projects/${projectId}`;
  const maxLevel = Math.max(1, ...position.byLevel.map((l) => l.committed + l.pipeline));
  const required = checks.filter((c) => c.required);
  const requiredMet = required.filter((c) => c.passed).length;

  return (
    <div className="mx-auto flex max-w-[1200px] flex-col gap-8 px-4 py-8 sm:px-[42px]">
      <div>
        <nav className="mb-3 flex flex-wrap items-center gap-2 text-sm text-[#374151]">
          <Link href={`/orgs/${orgId}/contracts/${contractId}`} className="hover:underline">{project.contract.name}</Link>
          <span aria-hidden="true">/</span>
          <Link href={base} className="hover:underline">{project.name}</Link>
        </nav>
        <h1 className="text-2xl font-bold tracking-tight text-[#111827]">PAS 2080 carbon management</h1>
        <p className="mt-2 max-w-[65ch] text-sm text-[#374151]">
          Baseline, target and reduction opportunities for {project.name}, worked down the PAS 2080:2023 carbon
          reduction hierarchy. Measured carbon comes from approved delivery notes, embodied carbon records and site activity.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Baseline" value={t(position.baseline)} note={plan?.baselineBasis ?? undefined} />
        <Kpi label="Target" value={t(position.target)} note={position.baseline && position.target ? `${(((position.baseline - position.target) / position.baseline) * 100).toFixed(0)}% below baseline` : undefined} />
        <Kpi
          label="Forecast"
          value={t(position.forecast)}
          note={position.gapToTarget == null ? "Baseline less committed savings" : position.gapToTarget <= 0 ? "Meets target" : `${t(position.gapToTarget)} still to find`}
          tone={position.gapToTarget == null ? undefined : position.gapToTarget <= 0 ? "good" : "warn"}
        />
        <Kpi label="Measured to date" value={t(measured.total)} note={`${t(measured.embodied)} embodied, ${t(measured.activity)} site activity`} />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Reduction hierarchy</CardTitle>
            <CardDescription>Estimated savings, committed (adopted or implemented) and still under consideration.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {position.byLevel.map((l, i) => (
              <div key={l.level}>
                <div className="flex items-baseline justify-between gap-3">
                  <p className="text-sm font-medium text-[#111827]">{l.label}</p>
                  <p className="text-xs tabular-nums text-[#374151]">
                    {t(l.committed)} committed{l.pipeline > 0 ? `, ${t(l.pipeline)} in review` : ""}
                  </p>
                </div>
                <p className="text-xs text-[#6B7280]">{HIERARCHY[i].prompt}</p>
                <div className="mt-1.5 flex h-2 overflow-hidden rounded-full bg-[#F3F4F6]" aria-hidden="true">
                  <div className="bg-[#c2410c]" style={{ width: `${(l.committed / maxLevel) * 100}%` }} />
                  <div className="bg-[#FED7AA]" style={{ width: `${(l.pipeline / maxLevel) * 100}%` }} />
                </div>
                <p className="mt-1 text-xs text-[#6B7280]">
                  {l.count} {l.count === 1 ? "opportunity" : "opportunities"}{l.rejected ? `, ${l.rejected} rejected` : ""}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">PAS 2080 checks</CardTitle>
            <CardDescription>
              {requiredMet} of {required.length} required checks met.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="flex flex-col gap-3">
              {checks.map((c) => (
                <li key={c.id} className="flex items-start gap-2 text-sm">
                  {c.passed ? (
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-700" aria-label="Met" />
                  ) : c.required ? (
                    <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" aria-label="Not met" />
                  ) : (
                    <CircleAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" aria-label="Warning" />
                  )}
                  <div className="min-w-0">
                    <p className="text-[#111827]">{c.description}</p>
                    <p className="text-xs text-[#6B7280]">{c.area}</p>
                    {c.message && <p className="mt-0.5 text-xs text-[#374151]">{c.message}</p>}
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Carbon management plan</CardTitle>
          <CardDescription>
            {plan ? `Your role: ${ROLE_LABELS[plan.valueChainRole]}.` : "Set your role, carbon lead, baseline, target and the life cycle modules they cover."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <PlanForm
            orgId={orgId}
            contractId={contractId}
            projectId={projectId}
            canEdit={canEdit}
            plan={
              plan
                ? {
                    valueChainRole: plan.valueChainRole,
                    carbonLeadName: plan.carbonLeadName,
                    baselineTco2e: plan.baselineTco2e,
                    baselineBasis: plan.baselineBasis,
                    targetTco2e: plan.targetTco2e,
                    modulesInScope: plan.modulesInScope,
                    notes: plan.notes,
                  }
                : null
            }
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Reduction opportunities</CardTitle>
          <CardDescription>
            Log every option considered, including the ones you reject, with the reason. Decided entries stay on the log.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <OpportunityLog
            orgId={orgId}
            contractId={contractId}
            projectId={projectId}
            canEdit={canEdit}
            opportunities={opportunities.map((o) => ({
              id: o.id,
              title: o.title,
              description: o.description,
              hierarchyLevel: o.hierarchyLevel,
              workStage: o.workStage,
              lifecycleModules: o.lifecycleModules,
              estimatedSavingTco2e: o.estimatedSavingTco2e,
              status: o.status,
              decisionRationale: o.decisionRationale,
              ownerName: o.ownerName,
            }))}
          />
        </CardContent>
      </Card>
    </div>
  );
}

function Kpi({ label, value, note, tone }: { label: string; value: string; note?: string; tone?: "good" | "warn" }) {
  return (
    <div className="rounded-[10px] border border-[#E5E7EB] bg-white p-4">
      <p className="text-xs text-[#374151]">{label}</p>
      <p className="mt-1 text-lg font-semibold tabular-nums text-[#111827]">{value}</p>
      {note && (
        <p className={`mt-1 line-clamp-2 text-xs ${tone === "good" ? "text-green-700" : tone === "warn" ? "text-amber-700" : "text-[#6B7280]"}`}>
          {note}
        </p>
      )}
    </div>
  );
}
