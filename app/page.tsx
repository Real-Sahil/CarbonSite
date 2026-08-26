import Link from "next/link";
import { HeroSection } from "@/components/hero-section";
import { SiteNav } from "@/components/marketing/site-nav";
import { SiteFooter } from "@/components/marketing/site-footer";
import { StandardsMarquee } from "@/components/marketing/standards-marquee";
import { AnimateIn } from "@/components/marketing/animate-in";
import { ArrowUpRight, Smartphone, ClipboardCheck, Calculator, FileText, ShieldCheck, Users } from "lucide-react";
import { CapabilitiesBg, HowItWorksBg, CtaBg } from "@/components/marketing/section-backgrounds";

const CAPABILITIES = [
  {
    n: "01",
    icon: Smartphone,
    title: "Field evidence capture",
    text: "Field workers photograph waste tickets and delivery notes. On-device OCR extracts weight, EWC codes, dates, and vehicle registrations — offline, no connectivity required.",
  },
  {
    n: "02",
    icon: ClipboardCheck,
    title: "Review and approval queue",
    text: "Every submission enters a triage queue. Reviewers inspect evidence, assign categories, add notes, and promote to committed records. Full comment thread and audit trail.",
  },
  {
    n: "03",
    icon: Calculator,
    title: "Calculation engine",
    text: "DEFRA 2025 and EPA GHG Hub factors. Scope 1, 2, and 3. Every result stores the factor used, the formula string, and the methodology version — immutable, traceable.",
  },
  {
    n: "04",
    icon: FileText,
    title: "Immutable snapshots",
    text: "Publishing locks a calculation run. Dashboard aggregates are pre-computed. Reports always match the dashboard for the same snapshot version — no reconciliation risk.",
  },
  {
    n: "05",
    icon: ShieldCheck,
    title: "Audit-ready reports",
    text: "Puppeteer-rendered PDF and CSV. SHA-256 checksums. 15-minute presigned download URLs. Every figure traces back to a factor, formula, and methodology version.",
  },
  {
    n: "06",
    icon: Users,
    title: "Six-role access control",
    text: "admin, editor, reviewer, viewer, auditor, field_worker — each precisely scoped. Field workers see only their own submissions. Auditors see completed periods only.",
  },
];

const HOW_IT_WORKS = [
  { step: "Collect", n: "01", text: "Mobile OCR capture or CSV/XLSX import. Staged rows are validated row-by-row before commit." },
  { step: "Review", n: "02", text: "Human oversight before any calculation. Assign categories, inspect evidence, approve or reject." },
  { step: "Calculate", n: "03", text: "Select factor library and period. The engine normalises units, selects factors, computes CO2e with AR6 GWPs." },
  { step: "Publish", n: "04", text: "Immutable snapshot links the period to a calculation run. Generate PDF and CSV reports." },
];

export default function RootPage() {
  return (
    <main className="min-h-[100dvh] overflow-hidden bg-[#171520]">
      <SiteNav theme="dark" />
      <HeroSection />

      {/* Standards marquee */}
      <StandardsMarquee />

      {/* ── Manifesto section ─────────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-[#171520]">
        {/* Mesh blobs */}
        <div className="absolute top-0 left-1/4 w-[500px] h-[500px] rounded-full bg-[radial-gradient(ellipse_at_center,rgba(245,158,11,0.12)_0%,transparent_70%)] pointer-events-none" />
        <div className="absolute bottom-0 right-0 w-[400px] h-[400px] rounded-full bg-[radial-gradient(ellipse_at_center,rgba(234,88,12,0.08)_0%,transparent_70%)] pointer-events-none" />

        <div className="relative mx-auto max-w-7xl px-6 md:px-10 py-28">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-start">
            <AnimateIn>
              <p className="text-[10px] text-amber-400 font-mono uppercase tracking-[0.14em] mb-5">Why CarbonSite</p>
              <h2 className="text-[clamp(2rem,4.5vw,3.2rem)] font-semibold tracking-[-0.04em] leading-[1.1] text-white">
                Carbon data that holds up{" "}
                <span className="bg-clip-text text-transparent bg-gradient-to-r from-amber-300 to-orange-300">
                  under audit.
                </span>
              </h2>
            </AnimateIn>
            <AnimateIn delay={0.1}>
              <div className="space-y-5 pt-2">
                <p className="text-base text-white/40 leading-relaxed">
                  Most teams manage emissions in spreadsheets. Data lives in email attachments,
                  calculations are manually totalled, and figures change between drafts with
                  no record of why.
                </p>
                <p className="text-base text-white/40 leading-relaxed">
                  CarbonSite replaces that with a proper accounting system — field evidence,
                  structured review, deterministic calculation, and immutable publication.
                  Every figure is traceable to a source document and a named emission factor.
                </p>
                <Link
                  href="/product"
                  className="inline-flex items-center gap-1.5 text-sm font-medium text-amber-400 hover:text-amber-300 transition-colors mt-2 group"
                >
                  Full platform overview
                  <ArrowUpRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                </Link>
              </div>
            </AnimateIn>
          </div>
        </div>
      </section>

      {/* ── Capabilities ──────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-[#171520]">
        <CapabilitiesBg />

        <div className="relative mx-auto max-w-7xl px-6 md:px-10 py-28">
          <AnimateIn>
            <div className="flex items-center gap-4 mb-4">
              <div className="w-6 h-px bg-gradient-to-r from-orange-500 to-amber-400" />
              <span className="text-[10px] font-mono text-amber-400 uppercase tracking-[0.14em]">Platform capabilities</span>
            </div>
            <h2 className="text-[clamp(1.8rem,4vw,2.8rem)] font-semibold tracking-[-0.04em] text-white mb-16">
              Everything in one place.
            </h2>
          </AnimateIn>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {CAPABILITIES.map((cap, i) => {
              const Icon = cap.icon;
              return (
                <AnimateIn key={cap.n} delay={i * 0.05}>
                  <div className="group relative rounded-2xl border border-white/8 bg-white/3 backdrop-blur-sm p-6 hover:border-amber-500/20 hover:bg-white/5 transition-all duration-300">
                    <div className="flex items-start justify-between mb-5">
                      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/10 border border-amber-500/20">
                        <Icon className="h-4.5 w-4.5 text-amber-400" />
                      </div>
                      <span className="text-[10px] font-mono text-white/20 tracking-widest">{cap.n}</span>
                    </div>
                    <h3 className="text-sm font-semibold text-white tracking-[-0.02em] mb-2">{cap.title}</h3>
                    <p className="text-sm text-white/35 leading-relaxed">{cap.text}</p>
                  </div>
                </AnimateIn>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── How it works — horizontal steps ──────────────────────────────── */}
      <section className="relative overflow-hidden bg-[#171520]">
        <HowItWorksBg />
        <div className="relative mx-auto max-w-7xl px-6 md:px-10 py-28">
          <AnimateIn>
            <div className="flex items-center gap-4 mb-4">
              <div className="w-6 h-px bg-gradient-to-r from-orange-500 to-amber-400" />
              <span className="text-[10px] font-mono text-amber-400 uppercase tracking-[0.14em]">How it works</span>
            </div>
            <h2 className="text-[clamp(1.8rem,4vw,2.8rem)] font-semibold tracking-[-0.04em] text-white mb-16">
              Four stages, end to end.
            </h2>
          </AnimateIn>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {HOW_IT_WORKS.map((s, i) => (
              <AnimateIn key={s.step} delay={i * 0.08}>
                <div className="relative rounded-2xl border border-white/8 bg-white/3 p-6 overflow-hidden group hover:border-amber-500/20 hover:bg-white/5 transition-all duration-300">
                  <div className="text-[3.5rem] font-semibold bg-clip-text text-transparent bg-gradient-to-br from-white/10 to-white/5 tracking-[-0.05em] leading-none mb-6 select-none">
                    {s.n}
                  </div>
                  <h3 className="text-sm font-semibold text-white tracking-[-0.02em] mb-2">{s.step}</h3>
                  <p className="text-sm text-white/35 leading-relaxed">{s.text}</p>
                  {/* Step connector dot */}
                  {i < HOW_IT_WORKS.length - 1 && (
                    <div className="hidden lg:block absolute -right-2 top-1/2 -translate-y-1/2 w-4 h-px bg-gradient-to-r from-amber-500/30 to-transparent z-10" />
                  )}
                </div>
              </AnimateIn>
            ))}
          </div>
        </div>
      </section>

      {/* ── Field app feature ─────────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-[#171520]">
        {/* Large teal blob */}
        <div className="absolute -bottom-32 -right-32 w-[700px] h-[700px] rounded-full bg-[radial-gradient(ellipse_at_center,rgba(245,158,11,0.18)_0%,transparent_65%)] pointer-events-none" />
        <div className="absolute top-1/4 left-[-100px] w-[400px] h-[400px] rounded-full bg-[radial-gradient(ellipse_at_center,rgba(124,58,237,0.10)_0%,transparent_70%)] pointer-events-none" />

        <div className="relative mx-auto max-w-7xl px-6 md:px-10 py-28">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <AnimateIn>
              <div>
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-6 h-px bg-gradient-to-r from-orange-500 to-amber-400" />
                  <span className="text-[10px] font-mono text-amber-400 uppercase tracking-[0.14em]">Mobile field app</span>
                </div>
                <h2 className="text-[clamp(1.8rem,4vw,2.8rem)] font-semibold tracking-[-0.04em] leading-[1.1] text-white mb-6">
                  Evidence captured at the{" "}
                  <span className="bg-clip-text text-transparent bg-gradient-to-r from-amber-300 to-orange-300">
                    point of activity.
                  </span>
                </h2>
                <p className="text-base text-white/40 leading-relaxed mb-5">
                  Field workers photograph waste tickets and delivery notes on-site.
                  On-device ML Kit OCR extracts the data instantly — weight, EWC code,
                  vehicle registration, date. No connectivity required.
                </p>
                <p className="text-base text-white/40 leading-relaxed mb-8">
                  Submissions save locally first and sync in the background when the device
                  has signal. GPS-tagged for route distance calculations and audit trail.
                </p>
                <Link
                  href="/field-app"
                  className="inline-flex items-center gap-1.5 text-sm font-medium text-amber-400 hover:text-amber-300 transition-colors group"
                >
                  About the field app
                  <ArrowUpRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                </Link>
              </div>
            </AnimateIn>

            <AnimateIn delay={0.12}>
              {/* Glassmorphic phone mockup card */}
              <div className="relative rounded-3xl border border-white/10 bg-white/4 backdrop-blur-sm p-8 overflow-hidden">
                <div className="absolute -top-12 -right-12 w-40 h-40 rounded-full bg-[radial-gradient(ellipse_at_center,rgba(245,158,11,0.3)_0%,transparent_70%)]" />
                <div className="relative space-y-4">
                  {/* Mock OCR result card */}
                  <div className="rounded-xl border border-white/8 bg-white/5 p-4">
                    <p className="text-[10px] font-mono text-amber-400 uppercase tracking-widest mb-3">OCR extracted</p>
                    <div className="grid grid-cols-2 gap-3">
                      {[
                        ["Weight", "4.2 t"],
                        ["EWC", "17 09 04"],
                        ["Vehicle", "AB12 CDE"],
                        ["Date", "25 Aug 2026"],
                      ].map(([label, value]) => (
                        <div key={label}>
                          <p className="text-[10px] text-white/30 mb-0.5">{label}</p>
                          <p className="text-sm font-medium text-white">{value}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                  {/* Mock status chip */}
                  <div className="flex items-center gap-2 px-3 py-2 rounded-full border border-amber-500/20 bg-amber-500/8 w-fit">
                    <div className="h-1.5 w-1.5 rounded-full bg-amber-400 shadow-[0_0_6px_rgba(251,191,36,0.8)]" />
                    <span className="text-xs text-amber-300 font-medium">Synced · Awaiting review</span>
                  </div>
                  {/* Mock category badge */}
                  <div className="flex flex-wrap gap-2">
                    {["Scope 1 · s1-mobile", "Mixed C&D waste"].map((tag) => (
                      <span key={tag} className="text-[10px] border border-white/10 rounded-full px-2.5 py-1 text-white/40">{tag}</span>
                    ))}
                  </div>
                </div>
              </div>
            </AnimateIn>
          </div>
        </div>
      </section>

      {/* ── CTA ── dark mesh gradient ─────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-[#171520]">
        <CtaBg />

        <div className="relative z-10 mx-auto max-w-7xl px-6 md:px-10 py-32">
          <AnimateIn>
            <div className="max-w-[40rem]">
              <p className="text-[10px] font-mono text-amber-400 uppercase tracking-[0.14em] mb-5">Get started today</p>
              <h2 className="text-[clamp(2rem,5vw,3.5rem)] font-semibold tracking-[-0.04em] leading-[1.05] text-white mb-6">
                Start tracking emissions{" "}
                <span className="bg-clip-text text-transparent bg-gradient-to-r from-amber-300 to-orange-300">
                  correctly.
                </span>
              </h2>
              <p className="text-base text-white/40 leading-relaxed mb-10">
                Create a free organisation. Run your first calculation in under an hour.
                No spreadsheet engineering, no paid APIs.
              </p>
              <div className="flex flex-wrap gap-3">
                <Link
                  href="/sign-up"
                  className="inline-flex items-center gap-2 px-7 py-3.5 rounded-full bg-gradient-to-r from-orange-500 to-amber-400 text-white text-sm font-medium shadow-[0_0_32px_rgba(245,158,11,0.45)] hover:shadow-[0_0_48px_rgba(245,158,11,0.6)] hover:from-orange-400 hover:to-amber-300 transition-all active:scale-[0.97]"
                >
                  Create organisation
                  <ArrowUpRight className="h-3.5 w-3.5" />
                </Link>
                <Link
                  href="/contact"
                  className="inline-flex items-center gap-2 px-7 py-3.5 rounded-full border border-white/15 text-white/60 text-sm font-medium hover:border-white/30 hover:text-white transition-all active:scale-[0.97]"
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
