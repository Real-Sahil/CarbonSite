import type { Metadata } from "next";
import Link from "next/link";
import { AnimateIn } from "@/components/marketing/animate-in";
import { ScrollReveal } from "@/components/scroll-reveal";
import { ScopeComparison } from "@/components/scope-comparison";
import { ArrowUpRight, Layers } from "lucide-react";
import { VideoBackground } from "@/components/ui/video-background";
import { ProductCtaBg } from "@/components/marketing/section-backgrounds";

export const metadata: Metadata = {
  title: "Product - CarbonSite",
  description: "Platform overview: field capture, import centre, review queue, calculation engine, snapshot publishing, and audit-ready reports.",
};

const STAGES = [
  {
    num: "01",
    title: "Collect and import",
    text: "Field workers use the mobile app to submit data from job sites. They can also work without internet — data saves on their phone and syncs later. Desktop users can upload spreadsheets (CSV or Excel). Bad data is flagged and can be fixed before it enters your system.",
    tags: ["Mobile app", "Upload spreadsheets", "Auto-check for errors", "Offline ready"],
  },
  {
    num: "02",
    title: "Review and approve",
    text: "All submissions go to a review queue. Your team checks the data, categorizes it, leaves comments, and approves or requests changes. Once approved, it becomes part of your official record.",
    tags: ["Review queue", "View evidence", "Comment threads", "Full history"],
  },
  {
    num: "03",
    title: "Calculate emissions",
    text: "Run a calculation for your reporting period. The system converts everything to standard units and calculates emissions using the latest standards (DEFRA 2025 and EPA). Every result includes which factors were used and when.",
    tags: ["Latest standards", "Automatic conversion", "Full traceability", "Multiple scopes"],
  },
  {
    num: "04",
    title: "Lock in your results",
    text: "Publish your calculation to lock it in. Once published, the numbers can't be accidentally changed. You can publish multiple versions, so your previous results are always available.",
    tags: ["Locked records", "Version history", "No accidental changes", "Previous records"],
  },
  {
    num: "05",
    title: "Generate reports",
    text: "Create branded reports in PDF or Excel for sharing with your team, board, or auditors. Every number in the report traces back to where it came from. You control who can see what.",
    tags: ["PDF and Excel", "Full traceability", "Share easily", "Audit ready"],
  },
];

const ROLES = [
  { role: "Admin", can: "Full access to settings, team, and all data. Manage who can do what." },
  { role: "Editor", can: "Create and update records, run calculations, publish results, and generate reports." },
  { role: "Reviewer", can: "Review and approve field submissions. Comment and ask questions." },
  { role: "Viewer", can: "See records, dashboards, and published reports. Can't make changes." },
  { role: "Auditor", can: "View only completed periods and final reports. Can't see work in progress." },
  { role: "Field Worker", can: "Submit data from the job site. See only their own submissions and status." },
];

export default function ProductPage() {
  return (
    <main className="min-h-[100dvh] bg-[#FAFBF8]">

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section className="relative min-h-[60vh] flex items-end overflow-hidden bg-[#0A1628]">
        <VideoBackground src="/videos/hero-product.mp4" overlayOpacity={0.30} />
        <div className="absolute bottom-0 inset-x-0 h-32 bg-gradient-to-t from-[#0A1628] to-transparent pointer-events-none" />

        <div className="relative z-10 mx-auto max-w-7xl w-full px-6 md:px-10 pb-20 pt-36">
          <AnimateIn>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-amber-500/20 bg-amber-500/8 mb-8">
              <Layers className="h-3.5 w-3.5 text-amber-400" />
              <span className="text-xs text-amber-400 tracking-[0.1em] font-medium">Platform overview</span>
            </div>
            <h1 className="text-[clamp(2.8rem,6vw,4.5rem)] font-semibold tracking-[-0.04em] leading-[0.95] text-[#F8FAFC] mb-6 max-w-[20ch]">
              One platform,{" "}
              <span className="bg-clip-text text-transparent bg-gradient-to-r from-amber-300 to-orange-300">
                end to end.
              </span>
            </h1>
            <p className="text-base text-[#94A3B8] leading-relaxed max-w-[50ch]">
              Five stages from field evidence to audit-ready report. Each stage is purpose-built, traceable, and role-controlled.
            </p>
          </AnimateIn>
        </div>
      </section>

      {/* ── Stages ───────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-[#F2F4EF]">
        <div className="mx-auto max-w-7xl px-6 md:px-10 py-24">
          <div className="border border-[#E5E7EB] divide-y divide-[#E5E7EB] rounded-2xl overflow-hidden">
            {STAGES.map((stage, i) => (
              <ScrollReveal key={stage.num} direction="up" delay={i * 0.08} duration={0.7}>
                <div className="bg-white hover:bg-[#FAFBF8] transition-colors p-8 md:p-10 grid grid-cols-1 md:grid-cols-[80px_1fr] gap-6">
                  <div className="text-[2.5rem] font-semibold bg-clip-text text-transparent bg-gradient-to-br from-amber-500/40 to-amber-500/10 tracking-[-0.05em] leading-none font-mono">
                    {stage.num}
                  </div>
                  <div>
                    <h2 className="text-base font-semibold text-[#111827] tracking-[-0.02em] mb-3">{stage.title}</h2>
                    <p className="text-sm text-[#6B7280] leading-relaxed mb-5 max-w-[65ch]">{stage.text}</p>
                    <div className="flex flex-wrap gap-2">
                      {stage.tags.map((tag) => (
                        <span key={tag} className="text-[11px] px-2.5 py-1 rounded-full border border-amber-500/20 text-amber-600 bg-amber-50 tracking-wide">
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
      <section className="relative overflow-hidden bg-[#FAFBF8]">
        <div className="relative z-10 mx-auto max-w-7xl px-6 md:px-10 py-24">
          <AnimateIn>
            <div className="flex items-center gap-4 mb-4">
              <div className="w-6 h-px bg-gradient-to-r from-orange-500 to-amber-400" />
              <span className="text-[10px] font-mono text-amber-600 uppercase tracking-[0.14em]">Access control</span>
            </div>
            <h2 className="text-[clamp(1.8rem,4vw,2.8rem)] font-semibold tracking-[-0.04em] text-[#111827] mb-3">
              Six roles, enforced server-side.
            </h2>
            <p className="text-sm text-[#6B7280] mb-12 max-w-[55ch]">
              Role is checked on the organisation membership record, not from client-supplied headers or tokens.
            </p>
          </AnimateIn>
          <div className="border border-[#E5E7EB] divide-y divide-[#E5E7EB] rounded-2xl overflow-hidden">
            {ROLES.map((r) => (
              <div key={r.role} className="grid grid-cols-1 md:grid-cols-[180px_1fr] hover:bg-[#F9FAFB] transition-colors">
                <div className="px-6 py-4 border-r border-[#E5E7EB]">
                  <code className="text-xs font-mono text-amber-600">{r.role}</code>
                </div>
                <div className="px-6 py-4">
                  <p className="text-sm text-[#6B7280]">{r.can}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Scope Comparison ─────────────────────────────────────────────── */}
      <section className="bg-[#F2F4EF] border-t border-[#E5E7EB] py-24 px-6">
        <div className="mx-auto max-w-7xl">
          <ScopeComparison />
        </div>
      </section>

      {/* ── CTA ─────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-[#0A1628]">
        <ProductCtaBg />
        <div className="relative z-10 mx-auto max-w-7xl px-6 md:px-10 py-28">
          <AnimateIn>
            <h2 className="text-[clamp(1.8rem,4vw,2.8rem)] font-semibold tracking-[-0.04em] text-[#F8FAFC] mb-4">
              Start your first reporting period.
            </h2>
            <p className="text-base text-[#94A3B8] mb-8 max-w-[45ch]">
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

    </main>
  );
}
