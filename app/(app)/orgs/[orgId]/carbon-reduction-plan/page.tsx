export const dynamic = "force-dynamic";

import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthError, requireOrgMember, ROLE_GROUPS } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { StartPlanForm } from "./start-plan-form";

type Props = { params: Promise<{ orgId: string }> };

const STATUS: Record<string, { label: string; cls: string }> = {
  draft: { label: "Draft", cls: "bg-amber-100 text-amber-800" },
  generated: { label: "Generated", cls: "bg-green-100 text-green-800" },
};

// Guided PPN 006 Carbon Reduction Plans, one per reporting period.
export default async function CarbonReductionPlansPage({ params }: Props) {
  const { orgId } = await params;
  let canEdit = false;
  try {
    const { membership } = await requireOrgMember(orgId, ...ROLE_GROUPS.dataReaders);
    canEdit = (ROLE_GROUPS.editor as string[]).includes(membership.role);
  } catch (err) {
    if (err instanceof AuthError) redirect("/sign-in");
    return <div className="p-8 text-sm text-red-600">Access denied.</div>;
  }

  const [plans, periods] = await Promise.all([
    prisma.carbonReductionPlan.findMany({
      where: { organizationId: orgId },
      orderBy: { updatedAt: "desc" },
      select: { id: true, status: true, updatedAt: true, reportingPeriod: { select: { label: true } } },
    }),
    prisma.reportingPeriod.findMany({
      where: { organizationId: orgId },
      orderBy: { startDate: "desc" },
      select: { id: true, label: true },
    }),
  ]);

  return (
    <div className="mx-auto max-w-4xl space-y-8 p-6 md:p-8">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Carbon Reduction Plan</h1>
        <p className="mt-2 max-w-2xl text-sm text-gray-600">
          A guided PPN 006 plan for central government contracts of £5 million a year or more. Each step checks what an evaluator
          looks for, the figures come from your published emissions, and the plan is generated in the Cabinet Office format with a
          director&apos;s sign-off.
        </p>
      </div>

      {canEdit ? (
        <section className="rounded-lg border border-gray-200 bg-white p-5">
          <h2 className="text-sm font-semibold text-gray-900">Start a plan</h2>
          <p className="mt-1 text-sm text-gray-600">
            Pick the reporting period the plan reports. Text from your latest plan is carried over so next year starts from this year.
          </p>
          <div className="mt-4">
            {periods.length ? (
              <StartPlanForm orgId={orgId} periods={periods} />
            ) : (
              <p className="text-sm text-gray-600">
                Create a reporting period first under{" "}
                <Link href={`/orgs/${orgId}/settings/periods`} className="text-[#c2410c] underline">
                  Settings
                </Link>
                .
              </p>
            )}
          </div>
        </section>
      ) : null}

      <section>
        <h2 className="text-sm font-semibold text-gray-900">Plans</h2>
        {plans.length === 0 ? (
          <p className="mt-2 text-sm text-gray-600">No plans yet.</p>
        ) : (
          <ul className="mt-3 divide-y divide-gray-100 rounded-lg border border-gray-200 bg-white">
            {plans.map((p) => {
              const st = STATUS[p.status] ?? STATUS.draft;
              return (
                <li key={p.id}>
                  <Link href={`/orgs/${orgId}/carbon-reduction-plan/${p.id}`} className="flex items-center justify-between gap-4 px-4 py-3 hover:bg-gray-50">
                    <span className="text-sm font-medium text-gray-900">{p.reportingPeriod.label}</span>
                    <span className="flex items-center gap-3">
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${st.cls}`}>{st.label}</span>
                      <span className="text-xs text-gray-500">
                        Updated {p.updatedAt.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                      </span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
