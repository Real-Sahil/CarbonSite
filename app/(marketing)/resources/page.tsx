import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { AnimateIn } from "@/components/marketing/animate-in";
import { SiteNav } from "@/components/marketing/site-nav";
import { SiteFooter } from "@/components/marketing/site-footer";
import { ArrowUpRight } from "lucide-react";

export const metadata: Metadata = {
  title: "Resources - CarbonSite",
  description: "Pilot planning, evidence standards, emission factor guidance, methodology notes, and GHG reporting references.",
};

const GUIDES = [
  {
    category: "Getting started",
    items: [
      {
        title: "Pilot planning checklist",
        text: "How to scope a first reporting period, choose a factor library, set up org structure (facilities, business units), and invite team members. Includes a suggested timeline for a 90-day pilot.",
      },
      {
        title: "Emission categories for construction",
        text: "Which GHG Protocol categories apply to typical main contractor, subcontractor, and waste-haulage operations. Scope 1, 2 and 3 decision tree with worked examples.",
      },
      {
        title: "Onboarding field workers",
        text: "Step-by-step guide for admins: generate invite link, set expiry, send by SMS or email, confirm receipt, and handle PIN setup issues. Includes the field_worker role permission summary.",
      },
    ],
  },
  {
    category: "Evidence standards",
    items: [
      {
        title: "What counts as acceptable evidence",
        text: "DEFRA guidance on supporting evidence for GHG inventory entries. Minimum requirements for waste tickets, fuel receipts, utility bills, and travel bookings. Photo quality guidance for OCR accuracy.",
      },
      {
        title: "Handling missing or incomplete evidence",
        text: "Using the assumptionNotes field. When estimation is acceptable versus when a record should be rejected. Documentation requirements for auditor review under SECR.",
      },
    ],
  },
  {
    category: "Emission factors",
    items: [
      {
        title: "DEFRA 2025 conversion factors",
        text: "Published by DESNZ under Open Government Licence v3. Used for UK-based Scope 1 combustion, Scope 2 electricity (UK grid: 0.207 kgCO2e/kWh location-based), and Scope 3 transport and freight factors.",
      },
      {
        title: "EPA GHG Emission Factors Hub",
        text: "US EPA factors for US-geography records. Natural gas at 0.18116 kgCO2e/kWh. Diesel at 2.705 kgCO2e/litre. US national grid at 0.371 kgCO2e/kWh. Public domain, no redistribution restrictions.",
      },
      {
        title: "IPCC AR6 global warming potentials",
        text: "GWP-100 values from the IPCC Sixth Assessment Report: CO2 = 1, CH4 = 27.9, N2O = 273. These replace AR5 values (CH4 = 25, N2O = 265) and affect calculation outputs where gas-specific factors are used.",
      },
    ],
  },
  {
    category: "Methodology and compliance",
    items: [
      {
        title: "GHG Protocol Corporate Standard",
        text: "The calculation methodology used by CarbonSite is ghg-protocol-v2026-01. Scope 1 includes direct emissions from owned or controlled sources. Scope 2 covers purchased electricity using location-based or market-based methods. Scope 3 covers 15 categories in the standard.",
      },
      {
        title: "SECR reporting requirements",
        text: "Streamlined Energy and Carbon Reporting applies to UK-quoted companies, large LLPs, and large unquoted companies. Minimum disclosure: energy and carbon figures, intensity ratio, methodology summary. CarbonSite audit packages include the required methodology statement.",
      },
      {
        title: "Factor library versioning policy",
        text: "When DEFRA or EPA update their factor publications, a new FactorLibrary version is created. Existing calculation runs reference their original library version, so historical figures do not change when factors are updated.",
      },
    ],
  },
];

const EXT_LINKS = [
  { label: "DEFRA 2025 Conversion Factors", href: "https://www.gov.uk/government/collections/government-conversion-factors-for-company-reporting", org: "DESNZ" },
  { label: "EPA GHG Emission Factors Hub", href: "https://www.epa.gov/climateleadership/ghg-emission-factors-hub", org: "US EPA" },
  { label: "GHG Protocol Corporate Standard", href: "https://ghgprotocol.org/corporate-standard", org: "WRI / WBCSD" },
  { label: "IPCC AR6 Working Group I Report", href: "https://www.ipcc.ch/report/ar6/wg1/", org: "IPCC" },
  { label: "SECR guidance", href: "https://www.gov.uk/guidance/streamlined-energy-and-carbon-reporting", org: "UK Government" },
  { label: "ISO 14064-1:2018", href: "https://www.iso.org/standard/66453.html", org: "ISO" },
];

export default function ResourcesPage() {
  return (
    <main className="min-h-[100dvh] bg-white">
      <SiteNav theme="dark" />

      {/* Hero */}
      <section className="relative min-h-[55vh] flex items-end overflow-hidden">
        <div className="absolute inset-0">
          <Image
            src="https://images.unsplash.com/photo-1526628653514-d4c3f4f63bff?w=1600&q=75"
            alt="Renewable energy resources climate knowledge documentation"
            fill
            priority
            className="object-cover object-center"
            sizes="100vw"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-white via-[#0F172A]/70 to-[#0F172A]/25" />
        </div>
        <div className="relative z-10 mx-auto max-w-7xl w-full px-6 md:px-10 pb-20 pt-36">
          <AnimateIn>
            <div className="flex items-center gap-4 mb-8">
              <div className="w-6 h-px bg-[#06B6D4]" />
              <span className="text-xs text-[#06B6D4] tracking-[0.12em] font-medium">Resources</span>
            </div>
            <h1 className="text-[clamp(2.8rem,6vw,4.5rem)] font-semibold tracking-[-0.04em] leading-[0.95] text-[#111827] mb-6 max-w-[20ch]">
              Guidance for getting started.
            </h1>
            <p className="text-base text-[#111827]/55 leading-relaxed max-w-[50ch]">
              Pilot planning, evidence standards, emission factor notes, and methodology references. Grounded in DEFRA 2025, EPA 2025, and GHG Protocol Corporate Standard.
            </p>
          </AnimateIn>
        </div>
      </section>

      {/* Guides */}
      <section className="bg-white">
        <div className="mx-auto max-w-7xl px-6 md:px-10 py-24 space-y-20">
          {GUIDES.map((section) => (
            <AnimateIn key={section.category}>
              <div>
                <div className="text-[10px] font-medium text-[#94A3B8] uppercase tracking-[0.12em] mb-8">
                  {section.category}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-px bg-[#E2E8F0]">
                  {section.items.map((item) => (
                    <div key={item.title} className="bg-white p-8 hover:bg-white transition-colors">
                      <h3 className="text-base font-semibold text-[#0F172A] tracking-[-0.02em] mb-3">{item.title}</h3>
                      <p className="text-sm text-[#64748B] leading-relaxed">{item.text}</p>
                    </div>
                  ))}
                </div>
              </div>
            </AnimateIn>
          ))}
        </div>
      </section>

      {/* External references */}
      <section className="bg-white">
        <div className="mx-auto max-w-7xl px-6 md:px-10 py-24">
          <AnimateIn>
            <div className="flex items-center gap-4 mb-8">
              <div className="w-6 h-px bg-[#06B6D4]" />
              <span className="text-xs text-[#64748B] tracking-[0.1em]">Primary references</span>
            </div>
            <h2 className="text-[clamp(1.8rem,4vw,2.8rem)] font-semibold tracking-[-0.04em] text-[#111827] mb-12">
              Original sources and standards.
            </h2>
          </AnimateIn>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-px bg-[#1E293B]">
            {EXT_LINKS.map((link, i) => (
              <AnimateIn key={link.label} delay={i * 0.04}>
                <a
                  href={link.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bg-white p-8 hover:bg-[#111110] transition-colors flex flex-col justify-between group"
                >
                  <div className="flex-1">
                    <h3 className="text-sm font-semibold text-[#111827] tracking-[-0.02em] mb-2 group-hover:text-[#0891B2] transition-colors">{link.label}</h3>
                    <p className="text-xs text-[#64748B]">{link.org}</p>
                  </div>
                  <div className="text-[#06B6D4] group-hover:text-[#0891B2] transition-colors mt-4 h-5 w-5">
                    <ArrowUpRight className="h-4 w-4" />
                  </div>
                </a>
              </AnimateIn>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-white border-t border-gray-200">
        <div className="mx-auto max-w-7xl px-6 md:px-10 py-24">
          <AnimateIn>
            <h2 className="text-[clamp(1.8rem,4vw,2.8rem)] font-semibold tracking-[-0.04em] text-[#0F172A] mb-4">
              Ready to run your first calculation?
            </h2>
            <Link
              href="/sign-up"
              className="inline-flex items-center gap-2 px-7 py-3.5 rounded-full bg-white text-[#111827] text-sm font-medium hover:bg-[#1A1A18] transition-colors active:scale-[0.97]"
            >
              Create organisation
              <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          </AnimateIn>
        </div>
      </section>

      <SiteFooter />
    </main>
  );
}
