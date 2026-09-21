import type { Metadata } from "next";
import Link from "next/link";
import { AnimateIn } from "@/components/marketing/animate-in";
import { SiteNav } from "@/components/marketing/site-nav";
import { SiteFooter } from "@/components/marketing/site-footer";
import { VideoBackground } from "@/components/ui/video-background";
import { ArrowUpRight, Mail, Building2, FileText, MapPin } from "lucide-react";
import { ContactForm } from "./contact-form";

export const metadata: Metadata = {
  title: "Contact - MetricOra",
  description: "Plan a MetricOra pilot around real project data.",
};

export default function ContactPage() {
  return (
    <main className="min-h-[100dvh] bg-[#FAFBF8]">
      <SiteNav theme="dark" />

      {/* Hero */}
      <section className="relative min-h-[60vh] flex items-end overflow-hidden bg-[#0B3B38]">
        <VideoBackground
          src="/videos/hero-contact.mp4"
          fallbackGradient="linear-gradient(135deg, #0B3B38 0%, #0D4A40 100%)"
          overlayOpacity={0.25}
        />
        <div className="absolute bottom-0 inset-x-0 h-32 bg-gradient-to-t from-[#0B3B38] to-transparent pointer-events-none" />
        <div className="relative z-10 mx-auto max-w-7xl w-full px-6 md:px-10 pb-20 pt-36">
          <AnimateIn>
            <div className="flex items-center gap-4 mb-8">
              <div className="w-6 h-px bg-teal-400" />
              <span className="text-xs text-teal-300 tracking-[0.12em] font-medium">Pilot contact</span>
            </div>
            <h1 className="text-[clamp(2.8rem,6vw,4.5rem)] font-semibold tracking-[-0.04em] leading-[0.95] text-[#F8FAFC] mb-6 max-w-[22ch]">
              Plan a MetricOra pilot around real project data.
            </h1>
            <p className="text-base text-[#A8C4C2] leading-relaxed max-w-[50ch] mb-8">
              Bring one construction project, one reporting period, field evidence, supplier files, and postcode routes. MetricOra proves the workflow with live tenant data.
            </p>
            <div className="flex flex-wrap gap-3">
              <a
                href="mailto:hello@metricora.co.uk?subject=MetricOra%20pilot%20request"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-[#0F766E] text-white text-sm font-medium hover:bg-white hover:text-[#0B3B38] shadow-[0_0_24px_rgba(15,118,110,0.40)] transition-all active:scale-[0.97]"
              >
                <Mail className="h-4 w-4" />
                Email pilot team
              </a>
              <Link
                href="/sign-up"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-full border border-[#A8C4C2]/30 text-[#A8C4C2] text-sm font-medium hover:border-[#A8C4C2]/60 hover:text-[#F8FAFC] transition-colors"
              >
                Create workspace
                <ArrowUpRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </AnimateIn>
        </div>
      </section>

      {/* Preparation guide */}
      <section className="bg-[#F2F4EF] border-b border-[#E5E7EB]">
        <div className="mx-auto max-w-7xl px-6 md:px-10 py-24">
          <AnimateIn>
            <h2 className="text-[clamp(1.8rem,4vw,2.8rem)] font-semibold tracking-[-0.04em] text-[#111827] mb-3">
              What to prepare for a useful pilot.
            </h2>
            <p className="text-sm text-[#6B7280] mb-12 max-w-[55ch]">
              The fastest pilot starts with actual operational records, not synthetic sample data.
            </p>
          </AnimateIn>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-px bg-[#E2ECEA]">
            {[
              {
                icon: Building2,
                title: "Organisation setup",
                text: "Confirm tenant name, admins, reviewers, facilities, business units, and reporting periods.",
              },
              {
                icon: FileText,
                title: "Data sources",
                text: "Bring supplier CSV or XLSX files, evidence PDFs or images, and field workers for mobile capture.",
              },
              {
                icon: MapPin,
                title: "Route distance",
                text: "Identify pickup and delivery postcode pairs for haulage, waste collections, or site deliveries.",
              },
            ].map(({ icon: Icon, title, text }) => (
              <div key={title} className="bg-white p-8 hover:bg-[#F4F8F7] transition-colors">
                <Icon className="h-6 w-6 text-teal-600 mb-4" />
                <h3 className="text-sm font-semibold text-[#111827] tracking-[-0.02em] mb-3">{title}</h3>
                <p className="text-sm text-[#6B7280] leading-relaxed">{text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pilot scope */}
      <section className="bg-[#FAFBF8]">
        <div className="mx-auto max-w-7xl px-6 md:px-10 py-24">
          <AnimateIn>
            <h2 className="text-[10px] font-mono text-teal-700 uppercase tracking-[0.14em] mb-8">Pilot scope template</h2>
            <div className="border border-[#E5E7EB] divide-y divide-[#E5E7EB] rounded-2xl overflow-hidden">
              {[
                ["Project", "One active UK construction project with a defined reporting period."],
                ["Users", "Admin, reviewer, auditor, and field-worker roles invited into the tenant."],
                ["Records", "Manual records, staged import rows, and mobile submissions approved into activity records."],
                ["Outputs", "Calculation run, published snapshot, report artefacts, evidence downloads, and audit trail."],
              ].map(([title, text]) => (
                <div key={title} className="grid grid-cols-1 md:grid-cols-[140px_1fr] bg-white hover:bg-[#FAFBF8] transition-colors">
                  <div className="px-6 py-5 border-r border-[#E5E7EB] font-semibold text-[#111827] text-sm">{title}</div>
                  <div className="px-6 py-5 text-sm text-[#6B7280]">{text}</div>
                </div>
              ))}
            </div>
          </AnimateIn>
        </div>
      </section>

      {/* Contact form */}
      <section className="bg-[#F2F4EF] border-y border-[#E5E7EB]">
        <div className="mx-auto max-w-7xl px-6 md:px-10 py-24">
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_480px] gap-16 items-start">
            <AnimateIn>
              <div className="flex items-center gap-4 mb-6">
                <div className="w-6 h-px bg-gradient-to-r from-teal-600 to-emerald-500" />
                <span className="text-[10px] font-mono text-teal-700 uppercase tracking-[0.14em]">Get in touch</span>
              </div>
              <h2 className="text-[clamp(1.8rem,4vw,2.8rem)] font-semibold tracking-[-0.04em] text-[#111827] mb-4">
                Start your pilot request.
              </h2>
              <p className="text-sm text-[#6B7280] max-w-[48ch] leading-relaxed mb-8">
                Describe your project and we'll plan a pilot around your actual operational data. We typically respond within one business day.
              </p>
              <div className="flex items-center gap-3">
                <a
                  href="mailto:hello@metricora.co.uk"
                  className="inline-flex items-center gap-2 text-sm text-[#6B7280] hover:text-[#111827] transition-colors"
                >
                  <Mail className="h-4 w-4" />
                  hello@metricora.co.uk
                </a>
              </div>
            </AnimateIn>
            <AnimateIn>
              <div className="bg-white rounded-2xl border border-[#E5E7EB] p-8">
                <ContactForm />
              </div>
            </AnimateIn>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-[#FAFBF8]">
        <div className="mx-auto max-w-7xl px-6 md:px-10 py-24 text-center">
          <AnimateIn>
            <h2 className="text-[clamp(1.8rem,4vw,2.8rem)] font-semibold tracking-[-0.04em] text-[#111827] mb-4">
              Ready to start your pilot?
            </h2>
            <p className="text-sm text-[#6B7280] mb-8 max-w-[45ch] mx-auto">
              Fill in the form above or create a free workspace to start exploring.
            </p>
            <Link
              href="/sign-up"
              className="inline-flex items-center gap-2 px-7 py-3.5 rounded-full bg-[#0F766E] hover:bg-[#0B5F59] text-white text-sm font-medium shadow-[0_0_24px_rgba(15,118,110,0.30)] transition-all active:scale-[0.97]"
            >
              Create workspace
              <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          </AnimateIn>
        </div>
      </section>

      <SiteFooter />
    </main>
  );
}
