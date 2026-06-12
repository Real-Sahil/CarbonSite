import type { Metadata } from "next";
import Link from "next/link";
import { AnimateIn } from "@/components/marketing/animate-in";

export const metadata: Metadata = {
  title: "Construction - CarbonSite",
  description: "GHG emissions tracking for main contractors, subcontractors, and site teams. Field capture, waste tickets, materials, and supplier evidence.",
};

const PAIN_POINTS = [
  {
    problem: "Waste tickets arrive on paper from dozens of subcontractors",
    solution: "Field workers photograph tickets on-site. On-device OCR extracts weight, EWC code, date, and vehicle registration in under 2 seconds. Offline queue syncs when connectivity returns.",
  },
  {
    problem: "Calculating embodied carbon across material deliveries is a manual process",
    solution: "Delivery notes processed through the same capture flow. Supplier evidence files attached to review tasks. Approved records feed into Scope 3 upstream transport and purchased goods categories.",
  },
  {
    problem: "Subcontractor fuel returns are inconsistent and hard to verify",
    solution: "Fuel receipts captured by drivers directly. OCR extracts volume, fuel type, date, and vehicle reg. The reviewer checks evidence before approving into Scope 1 mobile combustion.",
  },
  {
    problem: "Site managers need to submit data without access to the main platform",
    solution: "Admin sends an invite link - a signed token with a 7-day expiry. The subcontractor installs the Flutter app, taps the link, sets a PIN, and is immediately in submission mode. No email password account required.",
  },
];

const SCOPE_CATS = [
  { scope: 1, label: "Scope 1", cats: ["Stationary combustion (site plant, generators)", "Mobile combustion (fleet diesel and petrol)", "Fugitive emissions (refrigerant leakage)"], color: "#0f766e" },
  { scope: 2, label: "Scope 2", cats: ["Site electricity, location-based (UK grid 0.207 kgCO2e/kWh)", "Market-based where green tariff contracts exist"], color: "#0ea5e9" },
  { scope: 3, label: "Scope 3", cats: ["Upstream transport and distribution (tipper movements)", "Purchased goods and services (spend-based)", "Business travel and commuting"], color: "#84cc16" },
];

export default function ConstructionPage() {
  return (
    <>
      {/* Hero */}
      <section className="border-b border-zinc-800 py-24 px-5">
        <div className="mx-auto max-w-7xl">
          <AnimateIn>
            <div className="inline-flex items-center gap-2 rounded-full border border-zinc-700 px-3 py-1 mb-6 text-xs text-zinc-400">
              Construction
            </div>
            <h1 className="text-5xl md:text-6xl font-semibold tracking-tighter leading-tight max-w-3xl mb-6">
              Carbon tracking that fits the way construction works.
            </h1>
            <p className="text-lg text-zinc-400 leading-relaxed max-w-[55ch] mb-10">
              Waste tickets, delivery notes, fuel receipts, and subcontractor evidence -
              captured at source, reviewed on the platform, calculated to DEFRA 2025 standards.
            </p>
            <Link
              href="/sign-up"
              className="inline-flex items-center px-6 py-3 rounded-xl bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-500 transition-colors active:scale-[0.97]"
            >
              Start free trial
            </Link>
          </AnimateIn>
        </div>
      </section>

      {/* Pain points */}
      <section className="border-b border-zinc-800 px-5 py-20">
        <div className="mx-auto max-w-7xl">
          <AnimateIn>
            <h2 className="text-3xl font-semibold tracking-tighter text-white mb-2">
              Common challenges, solved.
            </h2>
            <p className="text-sm text-zinc-400 mb-12 max-w-[55ch]">
              Construction carbon data collection is fragmented. CarbonSite closes the gap
              between site activity and auditable reporting.
            </p>
          </AnimateIn>

          <div className="space-y-6">
            {PAIN_POINTS.map((p, i) => (
              <AnimateIn key={i} delay={i * 0.07}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-0 rounded-xl border border-zinc-800 overflow-hidden">
                  <div className="bg-zinc-900 p-6 border-r border-zinc-800">
                    <div className="text-xs text-zinc-500 uppercase tracking-widest mb-3">Challenge</div>
                    <p className="text-sm text-zinc-300 leading-relaxed">{p.problem}</p>
                  </div>
                  <div className="bg-zinc-900/50 p-6">
                    <div className="text-xs text-emerald-500 uppercase tracking-widest mb-3">CarbonSite</div>
                    <p className="text-sm text-zinc-400 leading-relaxed">{p.solution}</p>
                  </div>
                </div>
              </AnimateIn>
            ))}
          </div>
        </div>
      </section>

      {/* Scope coverage */}
      <section className="border-b border-zinc-800 px-5 py-20">
        <div className="mx-auto max-w-7xl">
          <AnimateIn>
            <h2 className="text-3xl font-semibold tracking-tighter text-white mb-12">
              Scope coverage for construction.
            </h2>
          </AnimateIn>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {SCOPE_CATS.map((s) => (
              <AnimateIn key={s.scope}>
                <div className="h-full rounded-xl border border-zinc-800 bg-zinc-900 p-6">
                  <div
                    className="inline-flex items-center gap-2 text-xs font-medium px-3 py-1 rounded-full mb-5"
                    style={{ background: `${s.color}18`, color: s.color }}
                  >
                    {s.label}
                  </div>
                  <ul className="space-y-3">
                    {s.cats.map((cat) => (
                      <li key={cat} className="flex items-start gap-2.5 text-sm text-zinc-400">
                        <span className="w-1.5 h-1.5 rounded-full mt-1.5 shrink-0" style={{ background: s.color }} />
                        {cat}
                      </li>
                    ))}
                  </ul>
                </div>
              </AnimateIn>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="px-5 py-20 text-center">
        <AnimateIn>
          <h2 className="text-3xl font-semibold tracking-tighter text-white mb-4">
            Built for construction carbon reporting.
          </h2>
          <p className="text-zinc-400 mb-8 max-w-[45ch] mx-auto">
            Read the field app page to see how site teams capture evidence,
            or start a free organisation now.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link href="/sign-up" className="inline-flex items-center justify-center px-6 py-3 rounded-xl bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-500 transition-colors active:scale-[0.97]">
              Create organisation
            </Link>
            <Link href="/field-app" className="inline-flex items-center justify-center px-6 py-3 rounded-xl border border-zinc-700 text-zinc-300 text-sm font-medium hover:border-zinc-500 hover:text-white transition-colors">
              See the field app
            </Link>
          </div>
        </AnimateIn>
      </section>
    </>
  );
}
