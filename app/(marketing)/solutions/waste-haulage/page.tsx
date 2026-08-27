import type { Metadata } from "next";
import Link from "next/link";
import { AnimateIn } from "@/components/marketing/animate-in";
import { VideoBackground } from "@/components/ui/video-background";
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
    <main className="min-h-[100dvh] bg-[#FAFBF8]">

      {/* Hero */}
      <section className="relative min-h-[65vh] flex items-end overflow-hidden">
        <VideoBackground src="/videos/hero-waste.mp4" overlayOpacity={0.30} />
        <div className="relative z-10 mx-auto max-w-7xl w-full px-6 md:px-10 pb-20 pt-36">
          <AnimateIn>
            <div className="flex items-center gap-4 mb-8">
              <div className="w-6 h-px bg-gradient-to-r from-orange-500 to-amber-400" />
              <span className="text-xs text-amber-400 tracking-[0.12em] font-medium">Waste and haulage</span>
            </div>
            <h1 className="text-[clamp(2.8rem,6vw,4.5rem)] font-semibold tracking-[-0.04em] leading-[0.95] text-[#F8FAFC] mb-6 max-w-[20ch]">
              From waste ticket to Scope 3 calculation.
            </h1>
            <p className="text-base text-[#94A3B8] leading-relaxed max-w-[50ch] mb-8">
              Waste tickets, transfer notes, carrier movements, and weighbridge dockets captured, reviewed, and included in GHG Protocol Scope 1 and 3 calculations.
            </p>
            <Link
              href="/sign-up"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-gradient-to-r from-orange-500 to-amber-400 text-white text-sm font-medium shadow-[0_0_24px_rgba(245,158,11,0.4)] hover:shadow-[0_0_36px_rgba(245,158,11,0.6)] transition-all active:scale-[0.97]"
            >
              Start free
              <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          </AnimateIn>
        </div>
      </section>

      {/* Document types */}
      <section className="bg-[#F2F4EF]">
        <div className="mx-auto max-w-7xl px-6 md:px-10 py-24">
          <AnimateIn>
            <h2 className="text-[clamp(1.8rem,4vw,2.8rem)] font-semibold tracking-[-0.04em] text-[#111827] mb-3">
              Document types supported.
            </h2>
            <p className="text-sm text-[#6B7280] mb-14 max-w-[55ch]">
              The mobile app recognises each document type and extracts the relevant fields. Web upload handles the same types via CSV or XLSX.
            </p>
          </AnimateIn>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-px bg-[#E5E7EB]">
            {DOCUMENT_TYPES.map((doc, i) => (
              <AnimateIn key={doc.type} delay={i * 0.06}>
                <div className="bg-[#F2F4EF] p-8 hover:bg-white transition-colors">
                  <div className="flex items-center justify-between mb-5">
                    <h3 className="text-sm font-semibold text-[#111827] tracking-[-0.02em]">{doc.type}</h3>
                    {doc.ocr && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full border border-amber-300 text-amber-700 bg-amber-50 tracking-wide">OCR</span>
                    )}
                  </div>
                  <ul className="space-y-2">
                    {doc.fields.map((field) => (
                      <li key={field} className="flex items-start gap-2.5 text-xs text-[#6B7280]">
                        <span className="mt-1.5 w-1 h-1 rounded-full bg-amber-300 shrink-0" />
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
      <section className="bg-[#FAFBF8]">
        <div className="mx-auto max-w-7xl px-6 md:px-10 py-24">
          <AnimateIn>
            <h2 className="text-[clamp(1.8rem,4vw,2.8rem)] font-semibold tracking-[-0.04em] text-[#111827] mb-3">
              EWC code recognition.
            </h2>
            <p className="text-sm text-[#6B7280] mb-12 max-w-[55ch]">
              The OCR extractor recognises the six-digit XX XX XX European Waste Catalogue format from photographed documents. Codes are validated against expected patterns before the form is pre-filled for reviewer confirmation.
            </p>
          </AnimateIn>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-[#E5E7EB]">
            {EWC_EXAMPLES.map((e, i) => (
              <AnimateIn key={e.code} delay={i * 0.04}>
                <div className="bg-white p-5 hover:bg-[#FFF7ED] transition-colors">
                  <code className="text-sm font-mono font-semibold text-amber-600">{e.code}</code>
                  <p className="text-xs text-[#6B7280] mt-1.5 leading-snug">{e.desc}</p>
                </div>
              </AnimateIn>
            ))}
          </div>
        </div>
      </section>

      {/* Calculation note */}
      <section className="bg-[#F2F4EF] border-t border-[#E5E7EB]">
        <div className="mx-auto max-w-7xl px-6 md:px-10 py-24">
          <AnimateIn>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-start">
              <div>
                <h2 className="text-[clamp(1.8rem,3.5vw,2.4rem)] font-semibold tracking-[-0.04em] text-[#111827] mb-5">
                  How waste is calculated.
                </h2>
                <div className="space-y-4 text-sm text-[#6B7280] leading-relaxed">
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
                  <div key={row.label} className="flex items-center justify-between py-3 border-b border-[#E5E7EB] last:border-0">
                    <span className="text-sm text-[#6B7280]">{row.label}</span>
                    <code className="text-sm font-mono text-[#111827]">{row.value}</code>
                  </div>
                ))}
              </div>
            </div>
          </AnimateIn>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-[#FAFBF8] border-t border-[#E5E7EB]">
        <div className="mx-auto max-w-7xl px-6 md:px-10 py-24">
          <AnimateIn>
            <h2 className="text-[clamp(1.8rem,4vw,2.8rem)] font-semibold tracking-[-0.04em] text-[#111827] mb-4">
              Waste carbon covered.
            </h2>
            <div className="flex flex-wrap gap-3">
              <Link
                href="/sign-up"
                className="inline-flex items-center gap-2 px-7 py-3.5 rounded-full bg-gradient-to-r from-orange-500 to-amber-400 text-white text-sm font-medium shadow-[0_0_24px_rgba(245,158,11,0.4)] hover:shadow-[0_0_36px_rgba(245,158,11,0.6)] transition-all active:scale-[0.97]"
              >
                Create organisation
                <ArrowUpRight className="h-3.5 w-3.5" />
              </Link>
              <Link
                href="/field-app"
                className="inline-flex items-center px-7 py-3.5 rounded-full border border-[#E5E7EB] text-[#6B7280] text-sm font-medium hover:border-[#374151] hover:text-[#111827] transition-colors"
              >
                See the mobile app
              </Link>
            </div>
          </AnimateIn>
        </div>
      </section>

    </main>
  );
}
