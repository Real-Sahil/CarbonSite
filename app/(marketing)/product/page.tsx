import type { Metadata } from "next";
import Link from "next/link";
import { AnimateIn } from "@/components/marketing/animate-in";
import { SiteNav } from "@/components/marketing/site-nav";
import { SiteFooter } from "@/components/marketing/site-footer";
import { ScrollReveal } from "@/components/scroll-reveal";
import { ScopeComparison } from "@/components/scope-comparison";
import { ArrowUpRight, Layers } from "lucide-react";
import { ProductHeroBg, ProductRolesBg, ProductCtaBg } from "@/components/marketing/section-backgrounds";

export const metadata: Metadata = {
  title: "Product - CarbonSite",
  description: "Platform overview: field capture, import centre, review queue, calculation engine, snapshot publishing, and audit-ready reports.",
};

const STAGES = [
  {
    num: "01",
    title: "Collect and import",
    text: "Field workers submit evidence via the mobile app — offline-first, on-device OCR. Desktop users upload CSV or XLSX files through the import centre. Each file is parsed, validated row by row, and staged. Rows with errors are quarantined with an error CSV download. No partial commits.",
    tags: ["CSV / XLSX import", "Mobile OCR capture", "Row-level validation", "Error export CSV"],
  },
  {
    num: "02",
    title: "Review and approve",
    text: "All field submissions and staged import rows enter a review queue. Reviewers inspect evidence files, assign emission categories and facilities, add comments, request changes, or reject with notes. Approval promotes a staged record to a committed ActivityRecord.",
    tags: ["Review task queue", "Evidence viewer", "Comment threads", "Audit trail"],
  },
  {
    num: "03",
    title: "Calculate emissions",
    text: "Trigger a calculation run for a reporting period. The engine normalises units, selects the best-scoring emission factor by geography and activity type, and computes CO2e using IPCC AR6 GWP-100 values. Every result is immutable: stored with the factor used, formula string, and methodology version.",
    tags: ["DEFRA 2025 factors", "EPA GHG Hub factors", "AR6 GWPs", "Per-record formula trace"],
  },
  {
    num: "04",
    title: "Publish snapshot",
    text: "Publishing creates an immutable PublishedSnapshot linking the reporting period to a specific calculation run. Snapshots are versioned — v1, v2 — so previous published figures are never overwritten. Dashboard aggregates rebuild automatically.",
    tags: ["Immutable versioning", "Pre-computed aggregates", "Scope 1/2/3 breakdown", "Facility breakdown"],
  },
  {
    num: "05",
    title: "Generate reports",
    text: "Select a snapshot and report type. Puppeteer renders a branded PDF from the snapshot data. Both PDF and CSV are uploaded with SHA-256 checksums. Download links are 15-minute presigned URLs generated server-side. Report totals always match the dashboard for the same snapshot.",
    tags: ["Puppeteer PDF", "Data export CSV", "SHA-256 checksums", "15-min signed URLs"],
  },
];

const ROLES = [
  { role: "admin", can: "Full access: org settings, members, all records and reports." },
  { role: "editor", can: "Create and edit records, trigger calculations, publish snapshots, generate reports." },
  { role: "reviewer", can: "Review and approve field submissions and import batches. Comment on records." },
  { role: "viewer", can: "Read-only access to records, dashboards, and published reports." },
  { role: "auditor", can: "Read-only access scoped to completed periods. Cannot see draft or in-progress data." },
  { role: "field_worker", can: "Submit field evidence and view their own submission status only. No org data." },
];

export default function ProductPage() {
  return (
    <main className="min-h-[100dvh] bg-[#060612]">
      <SiteNav theme="dark" />

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section className="relative min-h-[60vh] flex items-end overflow-hidden bg-[#060612]">
        <ProductHeroBg />
        <div className="absolute bottom-0 inset-x-0 h-32 bg-gradient-to-t from-[#060612] to-transparent pointer-events-none" />

        <div className="relative z-10 mx-auto max-w-7xl w-full px-6 md:px-10 pb-20 pt-36">
          <AnimateIn>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-amber-500/20 bg-amber-500/8 mb-8">
              <Layers className="h-3.5 w-3.5 text-amber-400" />
              <span className="text-xs text-amber-400 tracking-[0.1em] font-medium">Platform overview</span>
            </div>
            <h1 className="text-[clamp(2.8rem,6vw,4.5rem)] font-semibold tracking-[-0.04em] leading-[0.95] text-white mb-6 max-w-[20ch]">
              One platform,{" "}
              <span className="bg-clip-text text-transparent bg-gradient-to-r from-amber-300 to-orange-300">
                end to end.
              </span>
            </h1>
            <p className="text-base text-white/40 leading-relaxed max-w-[50ch]">
              Five stages from field evidence to audit-ready report. Each stage is purpose-built, traceable, and role-controlled.
            </p>
          </AnimateIn>
        </div>
      </section>

      {/* ── Stages ───────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-[#060612]">
        <div className="absolute inset-0 pointer-events-none"
          style={{ backgroundImage: "linear-gradient(rgba(255,255,255,0.014) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.014) 1px,transparent 1px)", backgroundSize: "56px 56px" }} />
        <div className="mx-auto max-w-7xl px-6 md:px-10 py-24">
          <div className="border border-white/8 divide-y divide-white/6 rounded-2xl overflow-hidden">
            {STAGES.map((stage, i) => (
              <ScrollReveal key={stage.num} direction="up" delay={i * 0.08} duration={0.7}>
                <div className="bg-white/2 hover:bg-white/4 transition-colors p-8 md:p-10 grid grid-cols-1 md:grid-cols-[80px_1fr] gap-6">
                  <div className="text-[2.5rem] font-semibold bg-clip-text text-transparent bg-gradient-to-br from-amber-400/40 to-amber-400/10 tracking-[-0.05em] leading-none font-mono">
                    {stage.num}
                  </div>
                  <div>
                    <h2 className="text-base font-semibold text-white tracking-[-0.02em] mb-3">{stage.title}</h2>
                    <p className="text-sm text-white/35 leading-relaxed mb-5 max-w-[65ch]">{stage.text}</p>
                    <div className="flex flex-wrap gap-2">
                      {stage.tags.map((tag) => (
                        <span key={tag} className="text-[11px] px-2.5 py-1 rounded-full border border-amber-500/20 text-amber-400 bg-amber-500/8 tracking-wide">
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── Role access control ──────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-[#060612] border-t border-white/6">
        <ProductRolesBg />
        <div className="relative z-10 mx-auto max-w-7xl px-6 md:px-10 py-24">
          <AnimateIn>
            <div className="flex items-center gap-4 mb-4">
              <div className="w-6 h-px bg-gradient-to-r from-orange-500 to-amber-400" />
              <span className="text-[10px] font-mono text-amber-400 uppercase tracking-[0.14em]">Access control</span>
            </div>
            <h2 className="text-[clamp(1.8rem,4vw,2.8rem)] font-semibold tracking-[-0.04em] text-white mb-3">
              Six roles, enforced server-side.
            </h2>
            <p className="text-sm text-white/40 mb-12 max-w-[55ch]">
              Role is checked on the organisation membership record — not from client-supplied headers or tokens.
            </p>
          </AnimateIn>
          <div className="border border-white/8 divide-y divide-white/6 rounded-2xl overflow-hidden">
            {ROLES.map((r) => (
              <div key={r.role} className="grid grid-cols-1 md:grid-cols-[180px_1fr] hover:bg-white/3 transition-colors">
                <div className="px-6 py-4 border-r border-white/6">
                  <code className="text-xs font-mono text-amber-400">{r.role}</code>
                </div>
                <div className="px-6 py-4">
                  <p className="text-sm text-white/40">{r.can}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Scope Comparison ─────────────────────────────────────────────── */}
      <section className="bg-[#060612] border-t border-white/6 py-24 px-6">
        <div className="mx-auto max-w-7xl">
          <ScopeComparison />
        </div>
      </section>

      {/* ── CTA ─────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-[#060612] border-t border-white/6">
        <ProductCtaBg />
        <div className="relative z-10 mx-auto max-w-7xl px-6 md:px-10 py-28">
          <AnimateIn>
            <h2 className="text-[clamp(1.8rem,4vw,2.8rem)] font-semibold tracking-[-0.04em] text-white mb-4">
              Start your first reporting period.
            </h2>
            <p className="text-base text-white/40 mb-8 max-w-[45ch]">
              Create an organisation, add facilities, invite your team. First calculation in under an hour.
            </p>
            <Link
              href="/sign-up"
              className="inline-flex items-center gap-2 px-7 py-3.5 rounded-full bg-gradient-to-r from-orange-500 to-amber-400 text-white text-sm font-medium shadow-[0_0_32px_rgba(245,158,11,0.45)] hover:shadow-[0_0_48px_rgba(245,158,11,0.6)] hover:from-orange-400 hover:to-amber-300 transition-all active:scale-[0.97]"
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
