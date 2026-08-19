import type { Metadata } from "next";
import { CalculationPipeline } from "@/components/calculation-pipeline";
import { CalculationFlowAnimation } from "@/components/calculation-flow-animation";
import { FactorLibraryShowcase } from "@/components/factor-library-showcase";
import { EmissionsBreakdownCard } from "@/components/emissions-breakdown-card";
import { SiteNav } from "@/components/marketing/site-nav";
import { SiteFooter } from "@/components/marketing/site-footer";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

export const metadata: Metadata = {
  title: "Calculation Engine - CarbonSite",
  description: "See how CarbonSite calculates emissions from activity records to audit-ready results. GHG Protocol methodology with DEFRA, EPA, and SustainMetrics factors.",
};

export default function CalculationPage() {
  return (
    <main className="min-h-[100dvh] overflow-hidden bg-white">
      <SiteNav theme="light" />
      <CalculationPipeline />

      {/* Interactive Calculation Flow */}
      <section className="bg-gradient-to-br from-white via-blue-50 to-cyan-50 py-24 px-6">
        <div className="mx-auto max-w-7xl">
          <CalculationFlowAnimation />
        </div>
      </section>

      {/* Emissions Breakdown Visualization */}
      <section className="bg-white py-24 px-6 border-t border-gray-200">
        <div className="mx-auto max-w-7xl">
          <EmissionsBreakdownCard />
        </div>
      </section>

      {/* Factor Library Showcase */}
      <section className="bg-gradient-to-br from-slate-50 via-white to-blue-50 py-24 px-6">
        <div className="mx-auto max-w-7xl">
          <FactorLibraryShowcase />
        </div>
      </section>

      {/* Audit Trail Section */}
      <section className="bg-gradient-to-br from-white to-blue-50 py-24 px-6">
        <div className="mx-auto max-w-7xl">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-white mb-6">
              Built for audit, not just dashboards.
            </h2>
            <p className="text-lg text-white/60 max-w-3xl mx-auto">
              Every calculation run is immutable. Every factor version is recorded. Every formula is stored.
              Your emissions data is audit-ready from day one.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                title: 'Append-Only Audit Log',
                description: 'Every action is recorded chronologically. No updates, no deletes—only new entries. Complete traceability.',
                icon: '📋',
              },
              {
                title: 'Immutable Snapshots',
                description: 'Publish a calculation run and lock it in. Dashboard aggregates are computed once and never recalculated.',
                icon: '🔒',
              },
              {
                title: 'Factor Versioning',
                description: 'DEFRA, EPA, and SustainMetrics versions are stored per calculation. Upgrade factors without recalculating history.',
                icon: '📚',
              },
            ].map((item, i) => (
              <div
                key={i}
                className="bg-white/10 backdrop-blur rounded-xl p-8 border border-white/20 text-white hover:bg-white/15 transition-colors"
              >
                <div className="text-4xl mb-4">{item.icon}</div>
                <h3 className="text-lg font-bold mb-3">{item.title}</h3>
                <p className="text-white/70 leading-relaxed text-sm">{item.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <SiteFooter />
    </main>
  );
}
