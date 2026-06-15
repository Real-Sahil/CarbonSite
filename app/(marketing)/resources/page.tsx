import type { Metadata } from "next";
import Link from "next/link";
import { AnimateIn } from "@/components/marketing/animate-in";

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
        text: "When DEFRA or EPA update their factor publications, a new FactorLibrary version is created. Existing calculation runs reference their original library version - historical figures do not change when factors are updated. Users see a diff before replacing a published snapshot.",
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
    <>
      {/* Hero */}
      <section className="border-b border-zinc-800 py-24 px-5">
        <div className="mx-auto max-w-7xl">
          <AnimateIn>
            <div className="inline-flex items-center gap-2 rounded-full border border-zinc-700 px-3 py-1 mb-6 text-xs text-zinc-400">
              Resources
            </div>
            <h1 className="text-5xl md:text-6xl font-semibold tracking-tighter leading-tight max-w-3xl mb-6">
              Guidance for getting started.
            </h1>
            <p className="text-lg text-zinc-400 leading-relaxed max-w-[55ch]">
              Pilot planning, evidence standards, emission factor notes, and
              methodology references. Grounded in DEFRA 2025, EPA 2025, and
              GHG Protocol Corporate Standard.
            </p>
          </AnimateIn>
        </div>
      </section>

      {/* Guides */}
      <section className="px-5 py-20">
        <div className="mx-auto max-w-7xl space-y-16">
          {GUIDES.map((section) => (
            <AnimateIn key={section.category}>
              <div>
                <div className="text-xs font-medium text-zinc-500 uppercase tracking-widest mb-6">
                  {section.category}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                  {section.items.map((item) => (
                    <div
                      key={item.title}
                      className="rounded-xl border border-zinc-800 bg-zinc-900 p-6"
                    >
                      <h3 className="text-sm font-semibold text-white mb-3">{item.title}</h3>
                      <p className="text-sm text-zinc-400 leading-relaxed">{item.text}</p>
                    </div>
                  ))}
                </div>
              </div>
            </AnimateIn>
          ))}
        </div>
      </section>

      {/* External references */}
      <section className="border-t border-zinc-800 px-5 py-16">
        <div className="mx-auto max-w-7xl">
          <AnimateIn>
            <h2 className="text-xl font-semibold tracking-tighter text-white mb-6">
              Primary references.
            </h2>
          </AnimateIn>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {EXT_LINKS.map((link, i) => (
              <AnimateIn key={link.label} delay={i * 0.04}>
                <a
                  href={link.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-start justify-between gap-3 rounded-lg border border-zinc-800 bg-zinc-900 hover:border-zinc-700 p-4 transition-colors group"
                >
                  <div>
                    <div className="text-sm text-zinc-200 group-hover:text-white transition-colors mb-1">{link.label}</div>
                    <div className="text-xs text-zinc-500">{link.org}</div>
                  </div>
                  <span className="text-zinc-600 group-hover:text-zinc-400 transition-colors mt-0.5 shrink-0">-&gt;</span>
                </a>
              </AnimateIn>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-zinc-800 px-5 py-20 text-center">
        <AnimateIn>
          <h2 className="text-3xl font-semibold tracking-tighter text-white mb-4">
            Ready to run your first calculation?
          </h2>
          <Link href="/sign-up" className="inline-flex items-center px-7 py-3 rounded-xl bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-500 transition-colors active:scale-[0.97]">
            Create organisation
          </Link>
        </AnimateIn>
      </section>
    </>
  );
}
