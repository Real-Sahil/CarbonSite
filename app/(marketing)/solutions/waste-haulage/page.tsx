import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { AnimateIn } from "@/components/marketing/animate-in";
import { SiteNav } from "@/components/marketing/site-nav";
import { SiteFooter } from "@/components/marketing/site-footer";
import { ArrowUpRight } from "lucide-react";

export const metadata: Metadata = {
  title: "Waste and Haulage - CarbonSite",
  description: "Waste ticket capture, EWC codes, transfer notes, carrier movements, and route evidence for waste and haulage operators.",
};

const DOCUMENT_TYPES = [
  {
    type: "Waste ticket",
    fields: ["Gross weight (kg/tonnes)", "EWC code (XX XX XX format)", "Waste description", "Date of collection", "Vehicle registration", "Site or transfer station"],
    ocr: true,
  },
  {
    type: "Transfer note",
    fields: ["Transfer note reference number", "Carrier details and licence", "Consignee address", "Waste type and EWC code", "Container type", "Signature date"],
    ocr: true,
  },
  {
    type: "Carrier movement",
    fields: ["Vehicle registration", "Route description", "Distance estimate", "Fuel type consumed", "Gross payload", "Departure and arrival site"],
    ocr: false,
  },
  {
    type: "Weighbridge docket",
    fields: ["Gross weight", "Tare weight", "Net weight", "Material type", "Job reference", "Date and time stamp"],
    ocr: true,
  },
];

const EWC_EXAMPLES = [
  { code: "17 01 01", desc: "Concrete" },
  { code: "17 01 02", desc: "Bricks" },
  { code: "17 01 03", desc: "Tiles and ceramics" },
  { code: "17 02 01", desc: "Wood" },
  { code: "17 02 02", desc: "Glass" },
  { code: "17 04 05", desc: "Iron and steel" },
  { code: "17 05 04", desc: "Soil and stones" },
  { code: "20 03 01", desc: "Mixed municipal waste" },
];

export default function WasteHaulagePage() {
  return (
    <main className="min-h-[100dvh] bg-[#0D0D0B]">
      <SiteNav theme="dark" />

      {/* Hero */}
      <section className="relative min-h-[65vh] flex items-end overflow-hidden">
        <div className="absolute inset-0">
          <Image
            src="https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=1600&q=75"
            alt="Waste haulage trucks at industrial facility"
            fill
            priority
            className="object-cover object-center"
            sizes="100vw"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-[#0D0D0B]/90 via-[#0D0D0B]/65 to-[#0D0D0B]/20" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0D0D0B]/80 to-transparent" />
        </div>
        <div className="relative z-10 mx-auto max-w-7xl w-full px-6 md:px-10 pb-20 pt-36">
          <AnimateIn>
            <div className="flex items-center gap-4 mb-8">
              <div className="w-6 h-px bg-[#3D6B52]" />
              <span className="text-xs text-[#3D6B52] tracking-[0.12em] font-medium">Waste and haulage</span>
            </div>
            <h1 className="text-[clamp(2.8rem,6vw,4.5rem)] font-semibold tracking-[-0.04em] leading-[0.95] text-white mb-6 max-w-[20ch]">
              From waste ticket to Scope 3 calculation.
            </h1>
            <p className="text-base text-white/55 leading-relaxed max-w-[50ch] mb-8">
              Waste tickets, transfer notes, carrier movements, and weighbridge dockets captured, reviewed, and included in GHG Protocol Scope 1 and 3 calculations.
            </p>
            <Link
              href="/sign-up"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-white text-[#0D0D0B] text-sm font-medium hover:bg-white/90 transition-colors active:scale-[0.97]"
            >
              Start free
              <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          </AnimateIn>
        </div>
      </section>

      {/* Document types */}
      <section className="bg-[#F5F4F0]">
        <div className="mx-auto max-w-7xl px-6 md:px-10 py-24">
          <AnimateIn>
            <h2 className="text-[clamp(1.8rem,4vw,2.8rem)] font-semibold tracking-[-0.04em] text-[#0D0D0B] mb-3">
              Document types supported.
            </h2>
            <p className="text-sm text-[#5C5B57] mb-14 max-w-[55ch]">
              The mobile app recognises each document type and extracts the relevant fields. Web upload handles the same types via CSV or XLSX.
            </p>
          </AnimateIn>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-px bg-[#E2E1DC]">
            {DOCUMENT_TYPES.map((doc, i) => (
              <AnimateIn key={doc.type} delay={i * 0.06}>
                <div className="bg-[#F5F4F0] p-8 hover:bg-white transition-colors">
                  <div className="flex items-center justify-between mb-5">
                    <h3 className="text-sm font-semibold text-[#0D0D0B] tracking-[-0.02em]">{doc.type}</h3>
                    {doc.ocr && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full border border-[#3D6B52]/30 text-[#3D6B52] tracking-wide">OCR</span>
                    )}
                  </div>
                  <ul className="space-y-2">
                    {doc.fields.map((field) => (
                      <li key={field} className="flex items-start gap-2.5 text-xs text-[#5C5B57]">
                        <span className="mt-1.5 w-1 h-1 rounded-full bg-[#E2E1DC] shrink-0" />
                        {field}
                      </li>
                    ))}
                  </ul>
                </div>
              </AnimateIn>
            ))}
          </div>
        </div>
      </section>

      {/* EWC codes */}
      <section className="bg-[#0D0D0B]">
        <div className="mx-auto max-w-7xl px-6 md:px-10 py-24">
          <AnimateIn>
            <h2 className="text-[clamp(1.8rem,4vw,2.8rem)] font-semibold tracking-[-0.04em] text-white mb-3">
              EWC code recognition.
            </h2>
            <p className="text-sm text-[#5C5B57] mb-12 max-w-[55ch]">
              The OCR extractor recognises the six-digit XX XX XX European Waste Catalogue format from photographed documents. Codes are validated against expected patterns before the form is pre-filled for reviewer confirmation.
            </p>
          </AnimateIn>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-[#2A2A27]">
            {EWC_EXAMPLES.map((e, i) => (
              <AnimateIn key={e.code} delay={i * 0.04}>
                <div className="bg-[#0D0D0B] p-5 hover:bg-[#111110] transition-colors">
                  <code className="text-sm font-mono font-semibold text-[#5A9E74]">{e.code}</code>
                  <p className="text-xs text-[#5C5B57] mt-1.5 leading-snug">{e.desc}</p>
                </div>
              </AnimateIn>
            ))}
          </div>
        </div>
      </section>

      {/* Calculation note */}
      <section className="bg-[#F5F4F0] border-t border-[#E2E1DC]">
        <div className="mx-auto max-w-7xl px-6 md:px-10 py-24">
          <AnimateIn>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-start">
              <div>
                <h2 className="text-[clamp(1.8rem,3.5vw,2.4rem)] font-semibold tracking-[-0.04em] text-[#0D0D0B] mb-5">
                  How waste is calculated.
                </h2>
                <div className="space-y-4 text-sm text-[#5C5B57] leading-relaxed">
                  <p>
                    Waste disposal is reported under Scope 3 upstream transportation (vehicle movements carrying waste) and where applicable under Scope 1 mobile combustion (fleet diesel for own-operated vehicles).
                  </p>
                  <p>
                    Weight-based records (tonnes of waste) use DEFRA 2025 freight factors: HGV average laden at 0.10749 kg CO2e per tonne.km. Van movements use the van average at 0.23092 kg CO2e per vehicle.km.
                  </p>
                  <p>
                    GWP values follow IPCC AR6 (CH4 = 27.9, N2O = 273). All factors reference the DEFRA 2025 conversion factors spreadsheet published by DESNZ.
                  </p>
                </div>
              </div>
              <div className="space-y-3">
                {[
                  { label: "HGV average laden", value: "0.10749 kgCO2e / tonne.km" },
                  { label: "Van average", value: "0.23092 kgCO2e / vehicle.km" },
                  { label: "GWP CH4 (AR6)", value: "27.9" },
                  { label: "GWP N2O (AR6)", value: "273" },
                ].map((row) => (
                  <div key={row.label} className="flex items-center justify-between py-3 border-b border-[#E2E1DC] last:border-0">
                    <span className="text-sm text-[#5C5B57]">{row.label}</span>
                    <code className="text-sm font-mono text-[#0D0D0B]">{row.value}</code>
                  </div>
                ))}
              </div>
            </div>
          </AnimateIn>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-[#0D0D0B]">
        <div className="mx-auto max-w-7xl px-6 md:px-10 py-24">
          <AnimateIn>
            <h2 className="text-[clamp(1.8rem,4vw,2.8rem)] font-semibold tracking-[-0.04em] text-white mb-4">
              Waste carbon covered.
            </h2>
            <div className="flex flex-wrap gap-3">
              <Link
                href="/sign-up"
                className="inline-flex items-center gap-2 px-7 py-3.5 rounded-full bg-white text-[#0D0D0B] text-sm font-medium hover:bg-white/90 transition-colors active:scale-[0.97]"
              >
                Create organisation
                <ArrowUpRight className="h-3.5 w-3.5" />
              </Link>
              <Link
                href="/field-app"
                className="inline-flex items-center px-7 py-3.5 rounded-full border border-white/20 text-white/70 text-sm font-medium hover:border-white/40 hover:text-white transition-colors"
              >
                See the mobile app
              </Link>
            </div>
          </AnimateIn>
        </div>
      </section>

      <SiteFooter />
    </main>
  );
}
