import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { AnimateIn } from "@/components/marketing/animate-in";
import { SiteNav } from "@/components/marketing/site-nav";
import { SiteFooter } from "@/components/marketing/site-footer";
import { ArrowUpRight } from "lucide-react";

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
    solution: "Admin sends an invite link with a 7-day expiry. The subcontractor installs the Flutter app, taps the link, sets a PIN, and is immediately in submission mode. No email/password account required.",
  },
];

const SCOPE_CATS = [
  { label: "Scope 1", cats: ["Stationary combustion (site plant, generators)", "Mobile combustion (fleet diesel and petrol)", "Fugitive emissions (refrigerant leakage)"] },
  { label: "Scope 2", cats: ["Site electricity, location-based (UK grid 0.207 kgCO2e/kWh)", "Market-based where green tariff contracts exist"] },
  { label: "Scope 3", cats: ["Upstream transport and distribution (tipper movements)", "Purchased goods and services (spend-based)", "Business travel and commuting"] },
];

export default function ConstructionPage() {
  return (
    <main className="min-h-[100dvh] bg-white">
      <SiteNav theme="dark" />

      {/* Hero */}
      <section className="relative min-h-[65vh] flex items-end overflow-hidden">
        <div className="absolute inset-0">
          <Image
            src="https://images.unsplash.com/photo-1560264357-8d9766d24a0f?w=1600&q=75"
            alt="Green construction sustainability carbon reduction building"
            fill
            priority
            className="object-cover object-center"
            sizes="100vw"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-white/90 via-[#0F172A]/65 to-[#0F172A]/20" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0F172A]/80 to-transparent" />
        </div>
        <div className="relative z-10 mx-auto max-w-7xl w-full px-6 md:px-10 pb-20 pt-36">
          <AnimateIn>
            <div className="flex items-center gap-4 mb-8">
              <div className="w-6 h-px bg-[#06B6D4]" />
              <span className="text-xs text-[#06B6D4] tracking-[0.12em] font-medium">Construction</span>
            </div>
            <h1 className="text-[clamp(2.8rem,6vw,4.5rem)] font-semibold tracking-[-0.04em] leading-[0.95] text-white mb-6 max-w-[22ch]">
              Carbon tracking that fits the way construction works.
            </h1>
            <p className="text-base text-white/55 leading-relaxed max-w-[50ch] mb-8">
              Waste tickets, delivery notes, fuel receipts, and subcontractor evidence captured at source, reviewed on the platform, calculated to DEFRA 2025 standards.
            </p>
            <Link
              href="/sign-up"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-white text-[#0F172A] text-sm font-medium hover:bg-white/90 transition-colors active:scale-[0.97]"
            >
              Start free
              <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          </AnimateIn>
        </div>
      </section>

      {/* Pain points */}
      <section className="bg-[#F5F4F0]">
        <div className="mx-auto max-w-7xl px-6 md:px-10 py-24">
          <AnimateIn>
            <h2 className="text-[clamp(1.8rem,4vw,2.8rem)] font-semibold tracking-[-0.04em] text-[#0F172A] mb-3">
              Common challenges, solved.
            </h2>
            <p className="text-sm text-[#64748B] mb-14 max-w-[55ch]">
              Construction carbon data collection is fragmented. CarbonSite closes the gap between site activity and auditable reporting.
            </p>
          </AnimateIn>
          <div className="space-y-px bg-[#E2E8F0]">
            {PAIN_POINTS.map((p, i) => (
              <AnimateIn key={i} delay={i * 0.06}>
                <div className="grid grid-cols-1 md:grid-cols-2 bg-[#F5F4F0] hover:bg-white transition-colors">
                  <div className="px-8 py-7 border-r border-[#E2E8F0]">
                    <div className="text-[10px] text-[#94A3B8] uppercase tracking-[0.12em] mb-3">Challenge</div>
                    <p className="text-sm text-[#0F172A] leading-relaxed">{p.problem}</p>
                  </div>
                  <div className="px-8 py-7">
                    <div className="text-[10px] text-[#06B6D4] uppercase tracking-[0.12em] mb-3">CarbonSite</div>
                    <p className="text-sm text-[#64748B] leading-relaxed">{p.solution}</p>
                  </div>
                </div>
              </AnimateIn>
            ))}
          </div>
        </div>
      </section>

      {/* Scope coverage */}
      <section className="bg-white">
        <div className="mx-auto max-w-7xl px-6 md:px-10 py-24">
          <AnimateIn>
            <h2 className="text-[clamp(1.8rem,4vw,2.8rem)] font-semibold tracking-[-0.04em] text-white mb-14">
              Scope coverage for construction.
            </h2>
          </AnimateIn>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-px bg-[#1E293B]">
            {SCOPE_CATS.map((s, i) => (
              <AnimateIn key={s.label} delay={i * 0.06}>
                <div className="bg-white p-8 hover:bg-[#111110] transition-colors">
                  <div className="text-[10px] font-medium text-[#06B6D4] tracking-[0.12em] mb-6">{s.label}</div>
                  <ul className="space-y-3">
                    {s.cats.map((cat) => (
                      <li key={cat} className="flex items-start gap-3 text-sm text-[#64748B]">
                        <span className="mt-1.5 w-1 h-1 rounded-full bg-[#06B6D4] shrink-0" />
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
      <section className="bg-[#F5F4F0] border-t border-[#E2E8F0]">
        <div className="mx-auto max-w-7xl px-6 md:px-10 py-24">
          <AnimateIn>
            <h2 className="text-[clamp(1.8rem,4vw,2.8rem)] font-semibold tracking-[-0.04em] text-[#0F172A] mb-4">
              Built for construction carbon reporting.
            </h2>
            <div className="flex flex-wrap gap-3">
              <Link
                href="/sign-up"
                className="inline-flex items-center gap-2 px-7 py-3.5 rounded-full bg-white text-white text-sm font-medium hover:bg-[#1A1A18] transition-colors active:scale-[0.97]"
              >
                Create organisation
                <ArrowUpRight className="h-3.5 w-3.5" />
              </Link>
              <Link
                href="/field-app"
                className="inline-flex items-center gap-2 px-7 py-3.5 rounded-full border border-[#E2E8F0] text-[#64748B] text-sm font-medium hover:border-[#0F172A] hover:text-[#0F172A] transition-colors"
              >
                See the field app
              </Link>
            </div>
          </AnimateIn>
        </div>
      </section>

      <SiteFooter />
    </main>
  );
}
