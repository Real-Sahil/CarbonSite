import type { Metadata } from "next";
import Link from "next/link";
import { AnimateIn } from "@/components/marketing/animate-in";

export const metadata: Metadata = {
  title: "Security - CarbonSite",
  description: "Multi-tenant data isolation, role-based access control, append-only audit logs, time-limited presigned URLs, and immutable calculation snapshots.",
};

const CONTROLS = [
  {
    area: "Multi-tenant isolation",
    detail: "Every organisation's data is strictly scoped at the query level. No tenant can access another organisation's records, files, or calculations — isolation is enforced in the data layer, not just in route handlers.",
    severity: "P0",
  },
  {
    area: "Role-based access control",
    detail: "Six roles govern what each user can see and do: admin, editor, reviewer, viewer, auditor, and field worker. Role assignment is managed server-side. Client-supplied claims are never trusted for authorisation decisions.",
    severity: "Core",
  },
  {
    area: "Object storage access",
    detail: "Evidence files, import data, and generated reports are stored in isolated object storage. Clients never receive raw storage keys or bucket credentials. All download links are short-lived, server-generated signed URLs issued only after authentication and membership verification.",
    severity: "Core",
  },
  {
    area: "Append-only audit log",
    detail: "Every authentication event, role change, data import, record mutation, calculation run, snapshot publication, report download, and submission review is permanently recorded. Audit rows are never modified or deleted, providing a tamper-evident trail for SECR and ISO 14064-1 compliance.",
    severity: "Core",
  },
  {
    area: "Immutable calculation snapshots",
    detail: "Publishing a snapshot locks the underlying calculation run. Reports produced from that snapshot will always reproduce the same figures. Recalculation produces a new versioned snapshot — prior versions are preserved and unchanged.",
    severity: "Core",
  },
  {
    area: "Rate limiting",
    detail: "Authentication, upload, and mutation endpoints are rate-limited per IP address. Limits are enforced before any route handler executes. Requests that exceed the limit receive a 429 response with a Retry-After header.",
    severity: "Defence",
  },
  {
    area: "Security headers",
    detail: "Every response carries security headers: clickjacking protection, content-type sniffing prevention, strict referrer policy, a permissions policy that restricts access to device APIs, and HSTS in production. Applied globally in middleware.",
    severity: "Defence",
  },
  {
    area: "Field worker isolation",
    detail: "External users (subcontractors, suppliers, tipper hires) operate in a strictly limited mode. They can submit evidence for the reporting periods they were invited to and check the status of their own submissions — nothing else. Organisation dashboards, calculations, and other users' data are completely inaccessible.",
    severity: "Core",
  },
];

const SEVERITY_STYLES: Record<string, string> = {
  P0: "bg-red-950 text-red-400 border-red-900",
  Core: "bg-zinc-800 text-zinc-300 border-zinc-700",
  Defence: "bg-blue-950 text-blue-400 border-blue-900",
};

export default function SecurityPage() {
  return (
    <>
      {/* Hero */}
      <section className="border-b border-zinc-800 py-24 px-5">
        <div className="mx-auto max-w-7xl max-w-3xl">
          <AnimateIn>
            <div className="inline-flex items-center gap-2 rounded-full border border-zinc-700 px-3 py-1 mb-6 text-xs text-zinc-400">
              Security
            </div>
            <h1 className="text-5xl md:text-6xl font-semibold tracking-tighter leading-tight mb-6">
              Designed to be audited.
            </h1>
            <p className="text-lg text-zinc-400 leading-relaxed max-w-[55ch]">
              Multi-tenant isolation, role-based access control, append-only audit logs,
              and immutable snapshots. Every control is enforced server-side.
            </p>
          </AnimateIn>
        </div>
      </section>

      {/* Controls */}
      <section className="px-5 py-20">
        <div className="mx-auto max-w-7xl">
          <div className="flex items-center gap-4 mb-10">
            {Object.entries(SEVERITY_STYLES).map(([sev, cls]) => (
              <span key={sev} className={`text-xs px-2.5 py-1 rounded-full border ${cls}`}>{sev}</span>
            ))}
            <span className="text-xs text-zinc-500">classification key</span>
          </div>

          <div className="space-y-4">
            {CONTROLS.map((control, i) => (
              <AnimateIn key={control.area} delay={i * 0.05}>
                <div className="grid grid-cols-1 md:grid-cols-[220px_80px_1fr] gap-0 rounded-xl border border-zinc-800 bg-zinc-900 overflow-hidden">
                  <div className="p-5 border-r border-zinc-800 flex items-start">
                    <span className="text-sm font-medium text-zinc-200">{control.area}</span>
                  </div>
                  <div className="p-5 border-r border-zinc-800 flex items-start justify-center">
                    <span className={`text-xs px-2 py-0.5 rounded-full border ${SEVERITY_STYLES[control.severity]}`}>
                      {control.severity}
                    </span>
                  </div>
                  <div className="p-5">
                    <p className="text-sm text-zinc-400 leading-relaxed">{control.detail}</p>
                  </div>
                </div>
              </AnimateIn>
            ))}
          </div>
        </div>
      </section>

      {/* Architecture note */}
      <section className="border-t border-zinc-800 px-5 py-20">
        <div className="mx-auto max-w-7xl">
          <AnimateIn>
            <div className="max-w-2xl">
              <h2 className="text-2xl font-semibold tracking-tighter text-white mb-4">
                No external auth dependencies.
              </h2>
              <p className="text-sm text-zinc-400 leading-relaxed mb-6">
                Authentication runs entirely on your own infrastructure. Session data lives in your
                database — not a third-party auth service — so you have full custody of who has access
                and when. Mobile clients use short-lived tokens with automatic renewal.
              </p>
              <p className="text-sm text-zinc-400 leading-relaxed">
                Files are stored in isolated, access-controlled object storage. Each organisation's
                content is scoped to its own namespace. Download links expire after a short window
                and are only issued to authenticated, authorised users.
              </p>
            </div>
          </AnimateIn>
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-zinc-800 px-5 py-20 text-center">
        <AnimateIn>
          <h2 className="text-3xl font-semibold tracking-tighter text-white mb-4">
            Security questions? Talk to the team.
          </h2>
          <Link href="/sign-up" className="inline-flex items-center px-7 py-3 rounded-xl bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-500 transition-colors active:scale-[0.97]">
            Create organisation
          </Link>
        </AnimateIn>
      </section>
    </>
  );
}
