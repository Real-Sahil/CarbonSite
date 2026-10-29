import { BklitScopeRing } from "@/components/charts/bklit-scope-ring";
import { BklitCategoryBar } from "@/components/charts/bklit-category-bar";
import { BklitTrendArea } from "@/components/charts/bklit-trend-area";
import type { SummaryCharts } from "@/lib/dashboard/summary-charts";

// The analytics under the Summary tiles: scope ring, top categories and, once two periods have data,
// the period trend. Values are kgCO2e; the chart components show tonnes.

export type SummaryChartsViewProps = SummaryCharts & { periodLabel: string | null; scopesKg: { scope1: number; scope2: number; scope3: number } };

function Panel({ title, note, children, wide }: { title: string; note: string; children: React.ReactNode; wide?: boolean }) {
  return (
    <section className={`e-card flex flex-col gap-3 p-5 ${wide ? "md:col-span-2 xl:col-span-1" : ""}`} aria-label={title}>
      <div>
        <h2 className="text-xs font-medium uppercase tracking-wide" style={{ color: "var(--ink-3)" }}>{title}</h2>
        <p className="mt-1 text-sm" style={{ color: "var(--ink-2)" }}>{note}</p>
      </div>
      {children}
    </section>
  );
}

export function SummaryChartsView({ categories, trend, periodLabel, scopesKg }: SummaryChartsViewProps) {
  const showTrend = trend.length >= 2;
  const ring = [
    { scope: 1, label: "Scope 1", value: scopesKg.scope1 },
    { scope: 2, label: "Scope 2", value: scopesKg.scope2 },
    { scope: 3, label: "Scope 3", value: scopesKg.scope3 },
  ];
  return (
    <div className={`grid gap-4 md:grid-cols-2 ${showTrend ? "xl:grid-cols-3" : ""} max-md:order-3`}>
      <Panel title="By scope" note={`${periodLabel ?? "Current period"}, location-based.`}>
        <BklitScopeRing data={ring} />
      </Panel>
      <Panel title="Top categories" note="Largest sources. The rest are grouped as other categories.">
        <BklitCategoryBar data={categories} />
      </Panel>
      {showTrend && (
        <Panel title="Period trend" note="Scope totals across reporting periods with calculated data." wide>
          <BklitTrendArea data={trend} />
        </Panel>
      )}
    </div>
  );
}
