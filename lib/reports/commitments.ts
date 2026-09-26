/**
 * What an organisation has committed to, read from its own records, for the
 * reports that print it (PPN 06/21, NHS Evergreen, CDP, ESRS E1, SECR, the
 * bid carbon pack). Before this, those reports took targets, the baseline and
 * the signatory only from report form options that the form never sent, so
 * they printed "net zero by 2050" and "no baseline" for every organisation.
 *
 * Sources, first found wins:
 * - net zero year: the Carbon Reduction Plan for the report's period, then the
 *   transition plan, then the latest Carbon Reduction Plan;
 * - interim targets, measures, signatory and SECR efficiency measures: that
 *   same Carbon Reduction Plan, plus reduction initiatives from the Targets page;
 * - baseline: the active base year;
 * - internal carbon price: the one in force at the period end (appraisalPrice()).
 *
 * Nothing here is invented: a value the organisation has not recorded is null.
 */
import { prisma } from "@/lib/db";
import { parseSections, planTargets, type CrpSections } from "@/lib/crp/plan";
import { loadCarbonPrices } from "@/lib/carbon-price/load";
import { appraisalPrice } from "@/lib/carbon-price";

export type CommitmentMeasure = { name: string; year: number | null; savingTco2e: number | null };

export type OrgCommitments = {
  baseYear: {
    label: string;
    year: number;
    s1: number | null;
    s2: number | null;
    s3: number | null;
    total: number | null;
  } | null;
  netZeroYear: number | null;
  interimTargets: { year: number; reductionPct: number; description?: string }[];
  completedMeasures: CommitmentMeasure[];
  plannedMeasures: CommitmentMeasure[];
  signatory: { name: string; title: string | null; date: string | null } | null;
  efficiencyMeasures: string[];
  carbonPrice: { name: string; priceType: string; pricePerTonne: number; currency: string; basis: string | null } | null;
};

const num = (d: { toString(): string } | null | undefined) => (d == null ? null : Number(d));

export async function loadOrgCommitments(
  orgId: string,
  period: { id: string; endDate: Date },
): Promise<OrgCommitments> {
  const [periodPlan, latestPlan, transitionPlan, baseYear, initiatives, prices] = await Promise.all([
    prisma.carbonReductionPlan.findFirst({
      where: { organizationId: orgId, reportingPeriodId: period.id },
      select: { sections: true },
    }),
    prisma.carbonReductionPlan.findFirst({
      where: { organizationId: orgId },
      orderBy: { updatedAt: "desc" },
      select: { sections: true },
    }),
    prisma.transitionPlan.findUnique({ where: { organizationId: orgId }, select: { netZeroYear: true } }),
    prisma.baseYear.findFirst({
      where: { organizationId: orgId, status: "active" },
      orderBy: { createdAt: "desc" },
      include: { reportingPeriod: { select: { endDate: true } } },
    }),
    prisma.reductionInitiative.findMany({
      where: { organizationId: orgId, status: { not: "canceled" } },
      select: { name: true, status: true, expectedImpactCo2e: true, expectedStartDate: true },
      orderBy: { createdAt: "asc" },
    }),
    loadCarbonPrices(orgId),
  ]);

  const plan: CrpSections | null = periodPlan
    ? parseSections(periodPlan.sections)
    : latestPlan
      ? parseSections(latestPlan.sections)
      : null;

  const netZeroYear =
    (periodPlan && plan?.targets.netZeroYear !== "" ? Number(plan!.targets.netZeroYear) : null) ??
    transitionPlan?.netZeroYear ??
    (plan && plan.targets.netZeroYear !== "" ? Number(plan.targets.netZeroYear) : null);

  const fromPlan = (m: CrpSections["measures"]["completed"][number]): CommitmentMeasure => ({
    name: m.name,
    year: m.year === "" ? null : Number(m.year),
    // A saving of 0 means none was estimated.
    savingTco2e: m.savingTco2e === "" || Number(m.savingTco2e) <= 0 ? null : Number(m.savingTco2e),
  });
  // Initiatives store kgCO2e a year.
  const fromInitiative = (i: (typeof initiatives)[number]): CommitmentMeasure => ({
    name: i.name,
    year: i.expectedStartDate ? i.expectedStartDate.getUTCFullYear() : null,
    savingTco2e: i.expectedImpactCo2e == null ? null : Number(i.expectedImpactCo2e) / 1000,
  });
  const dedupe = (list: CommitmentMeasure[]) => {
    const seen = new Set<string>();
    return list.filter((m) => {
      const key = m.name.trim().toLowerCase();
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  };

  const decl = plan?.declaration;
  const price = appraisalPrice(prices, period.endDate);

  return {
    baseYear: baseYear
      ? {
          label: baseYear.label,
          year: baseYear.reportingPeriod.endDate.getUTCFullYear(),
          s1: num(baseYear.currentScope1Co2e ?? baseYear.originalScope1Co2e),
          s2: num(baseYear.currentScope2Co2e ?? baseYear.originalScope2Co2e),
          s3: num(baseYear.currentScope3Co2e ?? baseYear.originalScope3Co2e),
          total: num(baseYear.currentTotalCo2e ?? baseYear.originalTotalCo2e),
        }
      : null,
    netZeroYear,
    interimTargets: plan ? planTargets(plan) : [],
    completedMeasures: dedupe([
      ...(plan?.measures.completed ?? []).map(fromPlan),
      ...initiatives.filter((i) => i.status === "complete").map(fromInitiative),
    ]),
    plannedMeasures: dedupe([
      ...(plan?.measures.planned ?? []).map(fromPlan),
      ...initiatives.filter((i) => i.status === "planned" || i.status === "in_progress").map(fromInitiative),
    ]),
    signatory: decl?.signatoryName
      ? { name: decl.signatoryName, title: decl.signatoryTitle || null, date: decl.signedDate || null }
      : null,
    efficiencyMeasures: (plan?.secr.efficiencyNarrative ?? "")
      .split(/\r?\n/)
      .map((l) => l.replace(/^[-*•]\s*/, "").trim())
      .filter(Boolean),
    carbonPrice: price
      ? { name: price.name, priceType: price.priceType, pricePerTonne: price.pricePerTonne, currency: price.currency, basis: price.basis }
      : null,
  };
}
