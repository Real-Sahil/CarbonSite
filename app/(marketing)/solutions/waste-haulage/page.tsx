import type { Metadata } from "next";
import Link from "next/link";
import { AnimateIn } from "@/components/marketing/animate-in";

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
  { code: "17 01 01", desc: "Concrete (construction demolition)" },
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
    <>
      {/* Hero */}
      <section className="border-b border-zinc-800 py-24 px-5">
        <div className="mx-auto max-w-7xl">
          <AnimateIn>
            <div className="inline-flex items-center gap-2 rounded-full border border-zinc-700 px-3 py-1 mb-6 text-xs text-zinc-400">
              Waste and haulage
            </div>
            <h1 className="text-5xl md:text-6xl font-semibold tracking-tighter leading-tight max-w-3xl mb-6">
              From waste ticket to Scope 3 calculation.
            </h1>
            <p className="text-lg text-zinc-400 leading-relaxed max-w-[55ch] mb-10">
              Waste tickets, transfer notes, carrier movements and weighbridge dockets
              captured, reviewed, and included in GHG Protocol Scope 1 and 3 calculations.
            </p>
            <Link href="/sign-up" className="inline-flex items-center px-6 py-3 rounded-xl bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-500 transition-colors active:scale-[0.97]">
              Start free
            </Link>
          </AnimateIn>
        </div>
      </section>

      {/* Document types */}
      <section className="border-b border-zinc-800 px-5 py-20">
        <div className="mx-auto max-w-7xl">
          <AnimateIn>
            <h2 className="text-3xl font-semibold tracking-tighter text-white mb-2">
              Document types supported.
            </h2>
            <p className="text-sm text-zinc-400 mb-12 max-w-[55ch]">
              The mobile app recognises each document type and extracts the relevant fields.
              Web upload handles the same types via CSV or XLSX.
            </p>
          </AnimateIn>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {DOCUMENT_TYPES.map((doc, i) => (
              <AnimateIn key={doc.type} delay={i * 0.07}>
                <div className="h-full rounded-xl border border-zinc-800 bg-zinc-900 p-6">
                  <div className="flex items-start justify-between mb-4">
                    <h3 className="text-sm font-semibold text-white">{doc.type}</h3>
                    {doc.ocr && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-400 border border-emerald-800">
                        OCR
                      </span>
                    )}
                  </div>
                  <ul className="space-y-2">
                    {doc.fields.map((field) => (
                      <li key={field} className="flex items-start gap-2.5 text-xs text-zinc-400">
                        <span className="w-1 h-1 rounded-full mt-1.5 shrink-0 bg-zinc-600" />
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
      <section className="border-b border-zinc-800 px-5 py-20">
        <div className="mx-auto max-w-7xl">
          <AnimateIn>
            <h2 className="text-3xl font-semibold tracking-tighter text-white mb-2">
              EWC code recognition.
            </h2>
            <p className="text-sm text-zinc-400 mb-10 max-w-[55ch]">
              The OCR extractor recognises the six-digit XX XX XX European Waste Catalogue format
              from photographed documents. Codes are validated against expected patterns before the
              form is pre-filled for reviewer confirmation.
            </p>
          </AnimateIn>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {EWC_EXAMPLES.map((e, i) => (
              <AnimateIn key={e.code} delay={i * 0.04}>
                <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
                  <code className="text-sm font-mono font-semibold text-emerald-400">{e.code}</code>
                  <p className="text-xs text-zinc-500 mt-1 leading-snug">{e.desc}</p>
                </div>
              </AnimateIn>
            ))}
          </div>
        </div>
      </section>

      {/* Calculation note */}
      <section className="border-b border-zinc-800 px-5 py-20">
        <div className="mx-auto max-w-7xl">
          <AnimateIn>
            <div className="max-w-2xl rounded-xl border border-zinc-800 bg-zinc-900 p-8">
              <h2 className="text-xl font-semibold text-white mb-4">
                How waste is calculated.
              </h2>
              <div className="space-y-3 text-sm text-zinc-400 leading-relaxed">
                <p>
                  Waste disposal is reported under <span className="text-zinc-200">Scope 3 - upstream transportation</span> (vehicle
                  movements carrying waste) and where applicable under <span className="text-zinc-200">Scope 1 - mobile combustion</span>
                  (fleet diesel for own-operated vehicles).
                </p>
                <p>
                  Weight-based records (tonnes of waste) use DEFRA 2025 freight factors:
                  HGV average laden at <span className="text-zinc-200 font-mono">0.10749 kg CO2e per tonne.km</span>.
                  Van movements use the van average at <span className="text-zinc-200 font-mono">0.23092 kg CO2e per vehicle.km</span>.
                </p>
                <p>
                  GWP values follow IPCC AR6 (CH4 = 27.9, N2O = 273). All factors reference
                  the DEFRA 2025 conversion factors spreadsheet published by DESNZ.
                </p>
              </div>
            </div>
          </AnimateIn>
        </div>
      </section>

      {/* CTA */}
      <section className="px-5 py-20 text-center">
        <AnimateIn>
          <h2 className="text-3xl font-semibold tracking-tighter text-white mb-4">
            Waste carbon covered.
          </h2>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link href="/sign-up" className="inline-flex items-center justify-center px-6 py-3 rounded-xl bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-500 transition-colors active:scale-[0.97]">
              Create organisation
            </Link>
            <Link href="/field-app" className="inline-flex items-center justify-center px-6 py-3 rounded-xl border border-zinc-700 text-zinc-300 text-sm font-medium hover:border-zinc-500 hover:text-white transition-colors">
              See the mobile app
            </Link>
          </div>
        </AnimateIn>
      </section>
    </>
  );
}
