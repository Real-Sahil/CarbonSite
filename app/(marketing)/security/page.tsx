import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { AnimateIn } from "@/components/marketing/animate-in";
import { SiteNav } from "@/components/marketing/site-nav";
import { SiteFooter } from "@/components/marketing/site-footer";
import { ArrowUpRight } from "lucide-react";

export const metadata: Metadata = {
  title: "Security - CarbonSite",
  description: "Multi-tenant data isolation, role-based access control, append-only audit logs, time-limited presigned URLs, and immutable calculation snapshots.",
};

const CONTROLS = [
  {
    area: "Multi-tenant isolation",
    tag: "P0",
    detail: "Every organisation's data is strictly scoped at the query level. No tenant can access another organisation's records, files, or calculations — isolation is enforced in the data layer, not just in route handlers.",
  },
  {
    area: "Role-based access control",
    tag: "Core",
    detail: "Six roles govern what each user can see and do: admin, editor, reviewer, viewer, auditor, and field worker. Role assignment is managed server-side. Client-supplied claims are never trusted for authorisation decisions.",
  },
  {
    area: "Object storage access",
    tag: "Core",
    detail: "Evidence files, import data, and generated reports are stored in isolated object storage. Clients never receive raw storage keys or bucket credentials. All download links are short-lived, server-generated signed URLs issued only after authentication and membership verification.",
  },
  {
    area: "Append-only audit log",
    tag: "Core",
    detail: "Every authentication event, role change, data import, record mutation, calculation run, snapshot publication, report download, and submission review is permanently recorded. Audit rows are never modified or deleted, providing a tamper-evident trail for SECR and ISO 14064-1 compliance.",
  },
  {
    area: "Immutable calculation snapshots",
    tag: "Core",
    detail: "Publishing a snapshot locks the underlying calculation run. Reports produced from that snapshot will always reproduce the same figures. Recalculation produces a new versioned snapshot — prior versions are preserved and unchanged.",
  },
  {
    area: "Rate limiting",
    tag: "Defence",
    detail: "Authentication, upload, and mutation endpoints are rate-limited per IP address. Limits are enforced before any route handler executes. Requests that exceed the limit receive a 429 response with a Retry-After header.",
  },
  {
    area: "Security headers",
    tag: "Defence",
    detail: "Every response carries security headers: clickjacking protection, content-type sniffing prevention, strict referrer policy, a permissions policy that restricts access to device APIs, and HSTS in production. Applied globally in middleware.",
  },
  {
    area: "Field worker isolation",
    tag: "Core",
    detail: "External users (subcontractors, suppliers, tipper hires) operate in a strictly limited mode. They can submit evidence for the reporting periods they were invited to and check the status of their own submissions — nothing else.",
  },
];

const TAG_STYLE: Record<string, string> = {
  P0:      "text-[#E05A5A] border-[#E05A5A]/30 bg-[#E05A5A]/8",
  Core:    "text-[#64748B] border-[#3D3D3A] bg-[#1A1A18]",
  Defence: "text-[#0891B2] border-[#06B6D4]/30 bg-[#06B6D4]/8",
};

export default function SecurityPage() {
  return (
    <main className="min-h-[100dvh] bg-[#0F172A]">
      <SiteNav theme="dark" />

      {/* Hero */}
      <section className="relative min-h-[55vh] flex items-end overflow-hidden">
        <div className="absolute inset-0">
          <Image
            src="https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=1600&q=75"
            alt="Server room infrastructure"
            fill
            priority
            className="object-cover object-center"
            sizes="100vw"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0F172A] via-[#0F172A]/70 to-[#0F172A]/25" />
        </div>
        <div className="relative z-10 mx-auto max-w-7xl w-full px-6 md:px-10 pb-20 pt-36">
          <AnimateIn>
            <div className="flex items-center gap-4 mb-8">
              <div className="w-6 h-px bg-[#06B6D4]" />
              <span className="text-xs text-[#06B6D4] tracking-[0.12em] font-medium">Security</span>
            </div>
            <h1 className="text-[clamp(2.8rem,6vw,4.5rem)] font-semibold tracking-[-0.04em] leading-[0.95] text-white mb-6 max-w-[18ch]">
              Designed to be audited.
            </h1>
            <p className="text-base text-white/55 leading-relaxed max-w-[50ch]">
              Multi-tenant isolation, role-based access control, append-only audit logs, and immutable snapshots. Every control is enforced server-side.
            </p>
          </AnimateIn>
        </div>
      </section>

      {/* Controls */}
      <section className="bg-[#0F172A]">
        <div className="mx-auto max-w-7xl px-6 md:px-10 py-24">
          <AnimateIn>
            <div className="flex items-center gap-4 mb-12">
              {Object.entries(TAG_STYLE).map(([tag, cls]) => (
                <span key={tag} className={`text-[10px] px-2.5 py-1 rounded-full border tracking-wide ${cls}`}>{tag}</span>
              ))}
              <span className="text-[10px] text-[#3D3D3A]">classification key</span>
            </div>
          </AnimateIn>
          <div className="border border-[#1E293B] divide-y divide-[#1E293B] overflow-hidden">
            {CONTROLS.map((control, i) => (
              <AnimateIn key={control.area} delay={i * 0.04}>
                <div className="grid grid-cols-1 md:grid-cols-[220px_80px_1fr] hover:bg-[#111110] transition-colors">
                  <div className="px-6 py-5 border-r border-[#1E293B]">
                    <span className="text-sm font-medium text-white">{control.area}</span>
                  </div>
                  <div className="px-6 py-5 border-r border-[#1E293B] flex items-start">
                    <span className={`text-[10px] px-2.5 py-1 rounded-full border tracking-wide ${TAG_STYLE[control.tag]}`}>
                      {control.tag}
                    </span>
                  </div>
                  <div className="px-6 py-5">
                    <p className="text-sm text-[#64748B] leading-relaxed">{control.detail}</p>
                  </div>
                </div>
              </AnimateIn>
            ))}
          </div>
        </div>
      </section>

      {/* Architecture note */}
      <section className="bg-[#F5F4F0] border-t border-[#E2E8F0]">
        <div className="mx-auto max-w-7xl px-6 md:px-10 py-24">
          <AnimateIn>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-start">
              <div>
                <h2 className="text-[clamp(1.8rem,3.5vw,2.4rem)] font-semibold tracking-[-0.04em] text-[#0F172A] mb-5">
                  No external auth dependencies.
                </h2>
                <p className="text-sm text-[#64748B] leading-relaxed mb-4">
                  Authentication runs entirely on your own infrastructure. Session data lives in your database — not a third-party auth service — so you have full custody of who has access and when. Mobile clients use short-lived tokens with automatic renewal.
                </p>
                <p className="text-sm text-[#64748B] leading-relaxed">
                  Files are stored in isolated, access-controlled object storage. Each organisation&apos;s content is scoped to its own namespace. Download links expire after a short window and are only issued to authenticated, authorised users.
                </p>
              </div>
              <div className="space-y-4">
                {["Cross-tenant access is a P0 security bug — enforced in the data layer.", "Audit rows are append-only. Never updated. Never deleted.", "Calculation results are immutable after publication.", "Field worker scope is zero — no org data, no other users."].map((point) => (
                  <div key={point} className="flex items-start gap-3">
                    <div className="mt-1.5 w-1 h-1 rounded-full bg-[#06B6D4] shrink-0" />
                    <p className="text-sm text-[#64748B] leading-relaxed">{point}</p>
                  </div>
                ))}
              </div>
            </div>
          </AnimateIn>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-[#0F172A]">
        <div className="mx-auto max-w-7xl px-6 md:px-10 py-24">
          <AnimateIn>
            <h2 className="text-[clamp(1.8rem,4vw,2.8rem)] font-semibold tracking-[-0.04em] text-white mb-4">
              Security questions? Talk to the team.
            </h2>
            <Link
              href="/contact"
              className="inline-flex items-center gap-2 px-7 py-3.5 rounded-full bg-white text-[#0F172A] text-sm font-medium hover:bg-white/90 transition-colors active:scale-[0.97]"
            >
              Get in touch
              <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          </AnimateIn>
        </div>
      </section>

      <SiteFooter />
    </main>
  );
}
