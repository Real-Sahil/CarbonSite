import { getOrgBasics } from "@/lib/i18n/org-basics";
import { formatters, orgFormat } from "@/lib/i18n/org-format";
import { prisma } from "@/lib/db";
import { loadAnalyticsPeriod } from "@/lib/analytics/period";
import { priorComparablePeriod } from "@/lib/dashboard/prior-period";
import { loadExecutiveSummary } from "@/lib/dashboard/executive-summary";
import { glidepathLine, greeting, hotspotLine, needsYouLine, socialPhaseLine } from "@/lib/dashboard/narrative";
import { isDisclosureRegime } from "@/lib/compliance/regimes";
import { loadRegimeReadiness } from "@/lib/compliance/regime-readiness";
import { SummaryView } from "@/components/earthy/summary-view";

// Server wrapper for the Executive Summary: a few cheap reads, one grouped loader statement, then the
// closed set of sentences. Rendered by dashboard/page.tsx behind earthyEnabled().
export async function EarthySummary({ orgId, firstName }: { orgId: string; firstName: string | null }) {
  const [org, periods, current, regimeRow] = await Promise.all([
    getOrgBasics(orgId).catch(() => null),
    prisma.reportingPeriod.findMany({
      where: { organizationId: orgId },
      select: { id: true, label: true, startDate: true, endDate: true },
      orderBy: [{ startDate: "desc" }, { createdAt: "desc" }],
    }),
    loadAnalyticsPeriod(orgId),
    prisma.organization.findUnique({ where: { id: orgId }, select: { disclosureRegime: true } }),
  ]);
  const regime = isDisclosureRegime(regimeRow?.disclosureRegime) ? regimeRow.disclosureRegime : null;
  const readiness = regime ? await loadRegimeReadiness(orgId, regime, prisma) : null;
  const f = formatters(orgFormat(org ?? {}));
  const fmt = { tonnes: (n: number) => `${f.tonnes(n)} tCO2e`, percent: (n: number) => f.percent(n / 100, 1) };

  const period = current ? periods.find((p) => p.id === current.id) ?? null : null;
  const prior = priorComparablePeriod(periods, period);
  const s = period ? await loadExecutiveSummary(orgId, period, prior) : null;

  const hour = Number(new Intl.DateTimeFormat("en-GB", { hour: "numeric", hour12: false, timeZone: "Europe/London" }).format(new Date()));
  const result = s?.target.result ?? null;

  return (
    <SummaryView
      orgId={orgId}
      isDemo={org?.isPilot === true}
      greeting={greeting({
        firstName,
        hour,
        hasData: s?.hasData ?? false,
        periodLabel: period?.label ?? null,
        totalTonnes: s?.totalTonnes ?? null,
        changePct: s?.changePct ?? null,
        fmt,
      })}
      periodLabel={period?.label ?? null}
      hasData={s?.hasData ?? false}
      total={{
        value: f.tonnes(s?.totalTonnes ?? 0),
        unit: "tCO2e",
        scopes: [
          { label: "Scope 1", value: f.tonnes(s?.scopeTonnes.scope1 ?? 0) },
          { label: "Scope 2", value: f.tonnes(s?.scopeTonnes.scope2 ?? 0) },
          { label: "Scope 3", value: f.tonnes(s?.scopeTonnes.scope3 ?? 0) },
        ],
      }}
      target={{
        line: glidepathLine(result, fmt),
        hasTarget: s?.target.hasTarget ?? false,
        actual: s?.totalTonnes != null ? fmt.tonnes(s.totalTonnes) : null,
        level: s?.target.targetTonnes != null ? fmt.tonnes(s.target.targetTonnes) : null,
        status: result?.status ?? null,
      }}
      hotspot={{ line: hotspotLine(s?.hotspot ?? null, fmt), sharePct: s?.hotspot?.sharePct ?? null }}
      social={{ line: socialPhaseLine(s?.socialPhase ?? null), phase: s?.socialPhase ?? "data_mapping" }}
      audit={readiness ? { regimeLabel: readiness.label, satisfied: readiness.satisfied, applicable: readiness.applicable, partial: readiness.partial, gap: readiness.gap, percent: readiness.percent } : null}
      needsYou={{
        line: needsYouLine(s?.needsYou ?? { pendingSubmissions: 0, openReviews: 0 }),
        pendingSubmissions: s?.needsYou.pendingSubmissions ?? 0,
        openReviews: s?.needsYou.openReviews ?? 0,
      }}
    />
  );
}
