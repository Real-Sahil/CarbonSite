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
      <SiteFooter />
    </main>
  );
}
