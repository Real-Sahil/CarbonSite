import type { Metadata } from "next";
import Link from "next/link";
import { AnimateIn } from "@/components/marketing/animate-in";

export const metadata: Metadata = {
  title: "Security - CarbonSite",
  description: "Multi-tenant data isolation, six-role RBAC, append-only audit logs, 15-minute presigned URLs, and immutable calculation snapshots.",
};

const CONTROLS = [
  {
    area: "Multi-tenant isolation",
    detail: "Every tenant-scoped table includes organization_id. Every database query must include an explicit org scope. Cross-tenant access is a P0 security classification. Enforced at the ORM query level, not just at the route level.",
    severity: "P0",
  },
  {
    area: "Role-based access control",
    detail: "Six roles: admin, editor, reviewer, viewer, auditor, field_worker. Checked on every org-scoped API request via requireOrgMember(). Role comes from the server-side membership record - never from a client-supplied header or body field.",
    severity: "Core",
  },
  {
    area: "Object storage access",
    detail: "Evidence files, import source files, error CSVs, and report PDFs live in Cloudflare R2. Clients never receive raw storage keys. Download URLs are 15-minute presigned URLs generated server-side after an auth and org-membership check.",
    severity: "Core",
  },
  {
    area: "Append-only audit log",
    detail: "Every auth event, role change, import, record mutation, calculation run, snapshot publication, report download, and field submission review is written to AuditLog. Rows are never updated or deleted. Required for SECR and ISO 14064-1 compliance evidence.",
    severity: "Core",
  },
  {
    area: "Immutable calculation snapshots",
    detail: "Publishing a snapshot locks the calculation run used to produce it. Reports generated from that snapshot will always reproduce the same figures. Recalculation creates a new PublishedSnapshot version - previous versions are never modified.",
    severity: "Core",
  },
  {
    area: "Rate limiting",
    detail: "Auth endpoints: 20 requests per minute per IP. Upload endpoints: 30/min. Mutations: 120/min. Read endpoints: 600/min. Applied in Next.js middleware before any route handler. Returns 429 with Retry-After header.",
    severity: "Defence",
  },
  {
    area: "Security headers",
    detail: "X-Frame-Options: DENY, X-Content-Type-Options: nosniff, Referrer-Policy: strict-origin-when-cross-origin, Permissions-Policy locks camera, microphone, geolocation, payment. HSTS in production. Applied on every response by middleware.",
    severity: "Defence",
  },
  {
    area: "Field worker isolation",
    detail: "The field_worker role has zero access to org dashboards, aggregate calculations, factor libraries, or any other user's submissions. They see only the reporting periods they were explicitly invited to and the status of their own submissions.",
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
              Multi-tenant isolation, six-role RBAC, append-only audit logs,
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
                Authentication is handled by Better Auth with Postgres sessions - your session data
                lives in your own database, not a third-party auth service. JWT tokens for the Flutter
                mobile client are issued by the same Better Auth instance with auto-refresh via Dio
                interceptor on 401.
              </p>
              <p className="text-sm text-zinc-400 leading-relaxed">
                Object storage uses Cloudflare R2 with org-scoped key conventions:
                <code className="text-zinc-200 font-mono text-xs ml-1">org/[orgId]/reports/[reportId]/report.pdf</code>.
                No cross-org key patterns are constructable. Presigned URLs have a 15-minute TTL.
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
