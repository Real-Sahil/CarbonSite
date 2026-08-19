import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { AnimateIn } from "@/components/marketing/animate-in";
import { SiteNav } from "@/components/marketing/site-nav";
import { SiteFooter } from "@/components/marketing/site-footer";
import { ArrowUpRight, Mail, Building2, FileText, MapPin } from "lucide-react";

export const metadata: Metadata = {
  title: "Contact - CarbonSite",
  description: "Plan a CarbonSite pilot around real project data.",
};

export default function ContactPage() {
  return (
    <main className="min-h-[100dvh] bg-white">
      <SiteNav theme="dark" />

      {/* Hero */}
      <section className="relative min-h-[60vh] flex items-end overflow-hidden">
        <div className="absolute inset-0">
          <Image
            src="https://images.unsplash.com/photo-1559027615-cd2628902d4a?w=1600&q=75"
            alt="Sustainability team climate action collaboration"
            fill
            priority
            className="object-cover object-center"
            sizes="100vw"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-blue-50 via-white to-white" />
        </div>
        <div className="relative z-10 mx-auto max-w-7xl w-full px-6 md:px-10 pb-20 pt-36">
          <AnimateIn>
            <div className="flex items-center gap-4 mb-8">
              <div className="w-6 h-px bg-[#06B6D4]" />
              <span className="text-xs text-[#06B6D4] tracking-[0.12em] font-medium">Pilot contact</span>
            </div>
            <h1 className="text-[clamp(2.8rem,6vw,4.5rem)] font-semibold tracking-[-0.04em] leading-[0.95] text-[#111827] mb-6 max-w-[22ch]">
              Plan a CarbonSite pilot around real project data.
            </h1>
            <p className="text-base text-[#111827]/55 leading-relaxed max-w-[50ch] mb-8">
              Bring one construction project, one reporting period, field evidence, supplier files, and postcode routes. CarbonSite proves the workflow with live tenant data.
            </p>
            <div className="flex flex-wrap gap-3">
              <a
                href="mailto:pilot@carbonsite.app?subject=CarbonSite%20pilot%20request"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-[#06B6D4] text-[#111827] text-sm font-medium hover:bg-[#0891B2] transition-colors active:scale-[0.97]"
              >
                <Mail className="h-4 w-4" />
                Email pilot team
              </a>
              <Link
                href="/sign-up"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-full border border-white/20 text-[#111827] text-sm font-medium hover:border-white/40 transition-colors"
              >
                Create workspace
                <ArrowUpRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </AnimateIn>
        </div>
      </section>

      {/* Preparation guide */}
      <section className="bg-[#F5F4F0] border-b border-[#E2E8F0]">
        <div className="mx-auto max-w-7xl px-6 md:px-10 py-24">
          <AnimateIn>
            <h2 className="text-[clamp(1.8rem,4vw,2.8rem)] font-semibold tracking-[-0.04em] text-[#0F172A] mb-3">
              What to prepare for a useful pilot.
            </h2>
            <p className="text-sm text-[#64748B] mb-12 max-w-[55ch]">
              The fastest pilot starts with actual operational records, not synthetic sample data.
            </p>
          </AnimateIn>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-px bg-[#E2E8F0]">
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
              <div key={title} className="bg-[#F5F4F0] p-8 hover:bg-white transition-colors">
                <Icon className="h-6 w-6 text-[#06B6D4] mb-4" />
                <h3 className="text-sm font-semibold text-[#0F172A] tracking-[-0.02em] mb-3">{title}</h3>
                <p className="text-sm text-[#64748B] leading-relaxed">{text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pilot scope */}
      <section className="bg-white">
        <div className="mx-auto max-w-7xl px-6 md:px-10 py-24">
          <AnimateIn>
            <h2 className="text-sm font-medium text-[#64748B] uppercase tracking-[0.1em] mb-8">Pilot scope template</h2>
            <div className="border border-[#1E293B] divide-y divide-[#1E293B] overflow-hidden">
              {[
                ["Project", "One active UK construction project with a defined reporting period."],
                ["Users", "Admin, reviewer, auditor, and field-worker roles invited into the tenant."],
                ["Records", "Manual records, staged import rows, and mobile submissions approved into activity records."],
                ["Outputs", "Calculation run, published snapshot, report artefacts, evidence downloads, and audit trail."],
              ].map(([title, text]) => (
                <div key={title} className="grid grid-cols-1 md:grid-cols-[140px_1fr] hover:bg-[#111110] transition-colors">
                  <div className="px-6 py-5 border-r border-[#1E293B] font-semibold text-[#111827] text-sm">{title}</div>
                  <div className="px-6 py-5 text-sm text-[#64748B]">{text}</div>
                </div>
              ))}
            </div>
          </AnimateIn>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-[#F5F4F0]">
        <div className="mx-auto max-w-7xl px-6 md:px-10 py-24 text-center">
          <AnimateIn>
            <h2 className="text-[clamp(1.8rem,4vw,2.8rem)] font-semibold tracking-[-0.04em] text-[#0F172A] mb-4">
              Ready to start your pilot?
            </h2>
            <p className="text-sm text-[#64748B] mb-8 max-w-[45ch] mx-auto">
              Email the pilot team with your project scope or create a free workspace to start exploring.
            </p>
            <a
              href="mailto:pilot@carbonsite.app?subject=CarbonSite%20pilot%20request"
              className="inline-flex items-center gap-2 px-7 py-3.5 rounded-full bg-white text-[#111827] text-sm font-medium hover:bg-[#1A1A18] transition-colors active:scale-[0.97]"
            >
              Get in touch
              <ArrowUpRight className="h-3.5 w-3.5" />
            </a>
          </AnimateIn>
        </div>
      </section>

      <SiteFooter />
    </main>
  );
}
