import type { Metadata } from "next";
import { CalculationPipeline } from "@/components/calculation-pipeline";
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
    <main className="min-h-[100dvh] bg-white">
      <SiteNav theme="light" />
      <CalculationPipeline />

      {/* Bottom CTA */}
      <section className="bg-gradient-to-r from-blue-600 to-cyan-500 py-24 px-6">
        <div className="mx-auto max-w-4xl text-center">
          <h2 className="text-4xl font-bold text-white mb-6">Your emissions. Fully transparent.</h2>
          <p className="text-lg text-white/90 mb-8 max-w-2xl mx-auto">
            Start tracking with a platform built for accuracy, auditability, and compliance.
          </p>
          <Link
            href="/sign-up"
            className="inline-flex items-center gap-2 px-8 py-4 bg-white text-blue-600 rounded-full font-semibold hover:bg-blue-50 transition-colors active:scale-[0.97]"
          >
            Create Organisation
            <ArrowUpRight className="h-5 w-5" />
          </Link>
        </div>
      </section>

      <SiteFooter />
    </main>
  );
}
