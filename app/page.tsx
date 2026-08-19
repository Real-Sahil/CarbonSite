import Link from "next/link";
import Image from "next/image";
import { HeroSection } from "@/components/hero-section";
import { SiteNav } from "@/components/marketing/site-nav";
import { SiteFooter } from "@/components/marketing/site-footer";
import { StandardsMarquee } from "@/components/marketing/standards-marquee";
import { AnimateIn } from "@/components/marketing/animate-in";
import { ScrollReveal } from "@/components/scroll-reveal";
import { ParallaxSection } from "@/components/parallax-section";
import { ArrowUpRight } from "lucide-react";

const CAPABILITIES = [
  {
    n: "01",
    title: "Field evidence capture",
    text: "Field workers photograph waste tickets and delivery notes. On-device OCR extracts weight, EWC codes, dates, and vehicle registrations — offline, no connectivity required.",
  },
  {
    n: "02",
    title: "Review and approval queue",
    text: "Every submission enters a triage queue. Reviewers inspect evidence, assign categories, add notes, and promote to committed records. Full comment thread and audit trail.",
  },
  {
    n: "03",
    title: "Calculation engine",
    text: "DEFRA 2025 and EPA GHG Hub factors. Scope 1, 2, and 3. Every result stores the factor used, the formula string, and the methodology version — immutable, traceable.",
  },
  {
    n: "04",
    title: "Immutable snapshots",
    text: "Publishing locks a calculation run. Dashboard aggregates are pre-computed. Reports always match the dashboard for the same snapshot version — no reconciliation risk.",
  },
  {
    n: "05",
    title: "Audit-ready reports",
    text: "Puppeteer-rendered PDF and CSV. SHA-256 checksums. 15-minute presigned download URLs. Every figure traces back to a factor, formula, and methodology version.",
  },
  {
    n: "06",
    title: "Six-role access control",
    text: "admin, editor, reviewer, viewer, auditor, field_worker — each precisely scoped. Field workers see only their own submissions. Auditors see completed periods only.",
  },
];

const HOW_IT_WORKS = [
  { step: "Collect", text: "Mobile OCR capture or CSV/XLSX import. Staged rows are validated row-by-row before commit." },
  { step: "Review", text: "Human oversight before any calculation. Assign categories, inspect evidence, approve or reject." },
  { step: "Calculate", text: "Select factor library and period. The engine normalises units, selects factors, computes CO2e with AR6 GWPs." },
  { step: "Publish", text: "Immutable snapshot links the period to a calculation run. Generate PDF and CSV reports." },
];

export default function RootPage() {
  return (
    <main className="min-h-[100dvh] overflow-hidden bg-white">
      <SiteNav theme="dark" />
      <HeroSection />

      {/* Standards marquee */}
      <StandardsMarquee />

      {/* ── Manifesto section ─────────────────────────────────────────────── */}
      <section className="bg-[#F5F4F0]">
        <div className="mx-auto max-w-7xl px-6 md:px-10 py-28">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-start">
            <AnimateIn>
              <h2 className="text-[clamp(2rem,4.5vw,3.2rem)] font-semibold tracking-[-0.04em] leading-[1.1] text-[#0F172A]">
                Carbon data that holds up under audit — not just in the dashboard.
              </h2>
            </AnimateIn>
            <AnimateIn delay={0.1}>
              <div className="space-y-5 pt-2">
                <p className="text-base text-[#64748B] leading-relaxed">
                  Most teams manage emissions in spreadsheets. Data lives in email attachments,
                  calculations are manually totalled, and figures change between drafts with
                  no record of why.
                </p>
                <p className="text-base text-[#64748B] leading-relaxed">
                  CarbonSite replaces that with a proper accounting system — field evidence,
                  structured review, deterministic calculation, and immutable publication.
                  Every figure is traceable to a source document and a named emission factor.
                </p>
                <Link
                  href="/product"
                  className="inline-flex items-center gap-1.5 text-sm font-medium text-[#06B6D4] hover:text-[#0891B2] transition-colors mt-2 group"
                >
                  Full platform overview
                  <ArrowUpRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                </Link>
              </div>
            </AnimateIn>
          </div>
        </div>
      </section>

      {/* ── Photo break ───────────────────────────────────────────────────── */}
      <ParallaxSection speed={0.3} className="relative h-[50vw] max-h-[560px] min-h-[300px] overflow-hidden">
        <Image
          src="https://images.unsplash.com/photo-1497493292307-31c376b9b1b7?w=1600&q=75"
          alt="CO2 carbon emissions and atmospheric monitoring"
          fill
          className="object-cover object-center"
          sizes="100vw"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-[#F5F4F0]/30 to-[#0F172A]/60" />
      </ParallaxSection>

      {/* ── Capabilities ──────────────────────────────────────────────────── */}
      <section className="bg-gradient-to-br from-[#fffbf0] to-white">
        <div className="mx-auto max-w-7xl px-6 md:px-10 py-28">
          <AnimateIn>
            <div className="flex items-center gap-4 mb-16">
              <div className="w-6 h-px bg-[#06B6D4]" />
              <span className="text-xs text-[#64748B] tracking-[0.1em]">Platform capabilities</span>
            </div>
          </AnimateIn>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-px bg-[#1E293B]">
            {CAPABILITIES.map((cap, i) => (
              <AnimateIn key={cap.n} delay={i * 0.05}>
                <div className="bg-[#0F172A] p-8 hover:bg-[#111110] transition-colors">
                  <div className="text-xs font-mono text-[#06B6D4] mb-6 tracking-widest">{cap.n}</div>
                  <h3 className="text-base font-semibold text-white tracking-[-0.02em] mb-3">{cap.title}</h3>
                  <p className="text-sm text-[#64748B] leading-relaxed">{cap.text}</p>
                </div>
              </AnimateIn>
            ))}
          </div>
        </div>
      </section>

      {/* ── How it works — horizontal steps ──────────────────────────────── */}
      <section className="bg-[#F5F4F0] border-t border-[#E2E8F0]">
        <div className="mx-auto max-w-7xl px-6 md:px-10 py-28">
          <AnimateIn>
            <h2 className="text-[clamp(1.8rem,4vw,2.8rem)] font-semibold tracking-[-0.04em] text-[#0F172A] mb-20">
              Four stages, end to end.
            </h2>
          </AnimateIn>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-0 divide-y md:divide-y-0 md:divide-x divide-[#E2E8F0]">
            {HOW_IT_WORKS.map((s, i) => (
              <AnimateIn key={s.step} delay={i * 0.08}>
                <div className="px-0 md:px-8 py-8 md:py-0 first:pl-0 last:pr-0">
                  <div className="text-[3.5rem] font-semibold text-[#E2E8F0] tracking-[-0.05em] leading-none mb-6">
                    {String(i + 1).padStart(2, "0")}
                  </div>
                  <h3 className="text-base font-semibold text-[#0F172A] tracking-[-0.02em] mb-2">{s.step}</h3>
                  <p className="text-sm text-[#64748B] leading-relaxed">{s.text}</p>
                </div>
              </AnimateIn>
            ))}
          </div>
        </div>
      </section>

      {/* ── Field app feature ─────────────────────────────────────────────── */}
      <section className="bg-gradient-to-br from-white to-blue-50">
        <div className="mx-auto max-w-7xl px-6 md:px-10 py-28">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <AnimateIn>
              <div>
                <div className="flex items-center gap-4 mb-10">
                  <div className="w-6 h-px bg-[#06B6D4]" />
                  <span className="text-xs text-[#64748B] tracking-[0.1em]">Mobile field app</span>
                </div>
                <h2 className="text-[clamp(1.8rem,4vw,2.8rem)] font-semibold tracking-[-0.04em] leading-[1.1] text-white mb-6">
                  Evidence captured at the point of activity.
                </h2>
                <p className="text-base text-[#64748B] leading-relaxed mb-6">
                  Field workers photograph waste tickets and delivery notes on-site.
                  On-device ML Kit OCR extracts the data instantly — weight, EWC code,
                  vehicle registration, date. No connectivity required.
                </p>
                <p className="text-base text-[#64748B] leading-relaxed mb-8">
                  Submissions save locally first and sync in the background when the device
                  has signal. GPS-tagged for route distance calculations and audit trail.
                </p>
                <Link
                  href="/field-app"
                  className="inline-flex items-center gap-1.5 text-sm font-medium text-[#06B6D4] hover:text-[#0891B2] transition-colors group"
                >
                  About the field app
                  <ArrowUpRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                </Link>
              </div>
            </AnimateIn>

            <AnimateIn delay={0.12}>
              <div className="relative rounded-2xl overflow-hidden aspect-[4/3]">
                <Image
                  src="https://images.unsplash.com/photo-1521737604893-6f3031224c94?w=900&q=80"
                  alt="Renewable energy solar panels field capturing clean power"
                  fill
                  className="object-cover"
                  sizes="(max-width: 1024px) 100vw, 50vw"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#0F172A]/60 to-transparent" />
              </div>
            </AnimateIn>
          </div>
        </div>
      </section>

      {/* ── CTA ── full bleed, minimal ────────────────────────────────────── */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0">
          <Image
            src="https://images.unsplash.com/photo-1504384308090-c894fdcc538d?w=1600&q=75"
            alt="Wind turbines renewable energy climate action sustainability"
            fill
            className="object-cover"
            sizes="100vw"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-[#0F172A]/40 to-[#0F172A]/60" />
        </div>
        <div className="relative z-10 mx-auto max-w-7xl px-6 md:px-10 py-32">
          <AnimateIn>
            <div className="max-w-[38rem]">
              <h2 className="text-[clamp(2rem,5vw,3.5rem)] font-semibold tracking-[-0.04em] leading-[1.05] text-white mb-6">
                Start tracking emissions correctly.
              </h2>
              <p className="text-base text-white/55 leading-relaxed mb-10">
                Create a free organisation. Run your first calculation in under an hour.
                No spreadsheet engineering, no paid APIs.
              </p>
              <div className="flex flex-wrap gap-3">
                <Link
                  href="/sign-up"
                  className="inline-flex items-center gap-2 px-7 py-3.5 rounded-full bg-white text-[#0F172A] text-sm font-medium hover:bg-white/90 transition-colors active:scale-[0.97]"
                >
                  Create organisation
                  <ArrowUpRight className="h-3.5 w-3.5" />
                </Link>
                <Link
                  href="/contact"
                  className="inline-flex items-center gap-2 px-7 py-3.5 rounded-full border border-white/20 text-white/75 text-sm font-medium hover:border-white/40 hover:text-white transition-colors active:scale-[0.97]"
                >
                  Talk to us
                </Link>
              </div>
            </div>
          </AnimateIn>
        </div>
      </section>

      <SiteFooter />
    </main>
  );
}
