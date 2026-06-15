import type { Metadata } from "next";
import Link from "next/link";
import { AnimateIn } from "@/components/marketing/animate-in";
import { CarbonFlowGraphic } from "@/components/marketing/carbon-flow";

export const metadata: Metadata = {
  title: "Product - CarbonSite",
  description: "Platform overview: field capture, import centre, review queue, calculation engine, snapshot publishing, and audit-ready reports.",
};

const STAGES = [
  {
    num: "01",
    title: "Collect and import",
    sub: "Multiple intake channels.",
    text: "Field workers submit evidence via the mobile app (offline-first, on-device OCR). Desktop users upload CSV or XLSX files through the import centre. Each file is parsed, column-mapped, validated row by row, and staged - rows with errors are quarantined with an error CSV download. No partial commits.",
    tags: ["CSV / XLSX import", "Mobile OCR capture", "Row-level validation", "Error export CSV"],
    color: "#0f766e",
  },
  {
    num: "02",
    title: "Review and approve",
    sub: "Human oversight before calculation.",
    text: "All field submissions and staged import rows enter a review queue. Reviewers with the reviewer, editor, or admin role can inspect evidence files, assign emission categories and facilities, add comments, request changes, or reject with notes. Approval promotes a staged record to a committed ActivityRecord.",
    tags: ["Review task queue", "Evidence viewer", "Comment threads", "Audit trail"],
    color: "#0ea5e9",
  },
  {
    num: "03",
    title: "Calculate emissions",
    sub: "Deterministic, fully traceable.",
    text: "Trigger a calculation run for a reporting period, selecting a factor library and methodology version. The engine normalises units (kWh, litre, kg, km, GBP), selects the best-scoring emission factor by geography and activity type, and computes CO2e using gas-specific GWP-100 values from IPCC AR6. Every result is immutable: stored with the factor used, formula string, and methodology version name.",
    tags: ["DEFRA 2025 factors", "EPA GHG Hub factors", "AR6 GWPs (CH4=27.9, N2O=273)", "Per-record formula trace"],
    color: "#84cc16",
  },
  {
    num: "04",
    title: "Publish snapshot",
    sub: "Lock the calculation run.",
    text: "Publishing creates an immutable PublishedSnapshot linking the reporting period to a specific calculation run. Snapshots are versioned - v1, v2 - so previous published figures are never overwritten. Dashboard aggregates rebuild automatically after each snapshot and read from pre-computed rows for sub-3-second load times even at 100k records.",
    tags: ["Immutable versioning", "Pre-computed aggregates", "Scope 1 / 2 / 3 breakdown", "Facility and BU breakdown"],
    color: "#8b5cf6",
  },
  {
    num: "05",
    title: "Generate reports",
    sub: "PDF and CSV, audit-ready.",
    text: "Select a snapshot and report type (inventory, monthly snapshot, or audit package). Puppeteer renders a branded PDF from the snapshot data. Both PDF and CSV are uploaded to Cloudflare R2 with SHA-256 checksums. Download links are 15-minute presigned URLs generated server-side after auth check. Totals in the report always match the dashboard for the same snapshot.",
    tags: ["Puppeteer PDF", "Data export CSV", "SHA-256 checksums", "15-min signed URLs"],
    color: "#f59e0b",
  },
];

const ROLES = [
  { role: "admin", can: "Full access: org settings, members, billing, all records and reports." },
  { role: "editor", can: "Create and edit records, trigger calculations, publish snapshots, generate reports." },
  { role: "reviewer", can: "Review and approve field submissions and import batches. Comment on records." },
  { role: "viewer", can: "Read-only access to records, dashboards, and published reports." },
  { role: "auditor", can: "Read-only access scoped to completed periods. Cannot see draft or in-progress data." },
  { role: "field_worker", can: "Submit field evidence and view their own submission status only. No org data." },
];

export default function ProductPage() {
  return (
    <>
      {/* Hero */}
      <section className="border-b border-zinc-800 py-20 px-5">
        <div className="mx-auto max-w-7xl">
          <AnimateIn>
            <div className="inline-flex items-center gap-2 rounded-full border border-zinc-700 px-3 py-1 mb-6 text-xs text-zinc-400">
              Platform overview
            </div>
            <h1 className="text-5xl md:text-6xl font-semibold tracking-tighter leading-tight max-w-3xl mb-6">
              One platform, end to end.
            </h1>
            <p className="text-lg text-zinc-400 leading-relaxed max-w-[55ch] mb-10">
              Five stages from field evidence to audit-ready report. Each stage
              is purpose-built, traceable, and role-controlled.
            </p>
          </AnimateIn>
          <AnimateIn delay={0.15}>
            <CarbonFlowGraphic className="max-w-2xl" />
          </AnimateIn>
        </div>
      </section>

      {/* Workflow stages */}
      <section className="px-5 py-16">
        <div className="mx-auto max-w-7xl space-y-12">
          {STAGES.map((stage) => (
            <AnimateIn key={stage.num}>
              <div className="grid grid-cols-1 md:grid-cols-[160px_1fr] gap-6 rounded-xl border border-zinc-800 bg-zinc-900 p-8">
                <div>
                  <div className="text-5xl font-bold tracking-tighter mb-2" style={{ color: stage.color }}>
                    {stage.num}
                  </div>
                  <div className="text-xs text-zinc-500 uppercase tracking-widest">{stage.sub}</div>
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-white mb-3">{stage.title}</h2>
                  <p className="text-sm text-zinc-400 leading-relaxed mb-5 max-w-[65ch]">{stage.text}</p>
                  <div className="flex flex-wrap gap-2">
                    {stage.tags.map((tag) => (
                      <span
                        key={tag}
                        className="text-xs px-2.5 py-1 rounded-full border"
                        style={{ borderColor: `${stage.color}50`, color: stage.color, background: `${stage.color}10` }}
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </AnimateIn>
          ))}
        </div>
      </section>

      {/* Role table */}
      <section className="border-t border-zinc-800 px-5 py-16">
        <div className="mx-auto max-w-7xl">
          <AnimateIn>
            <h2 className="text-3xl font-semibold tracking-tighter text-white mb-2">Access control.</h2>
            <p className="text-sm text-zinc-400 mb-10 max-w-[55ch]">
              Six roles, enforced server-side on every request. Role is checked on the organisation membership
              record - not from client-supplied headers or tokens.
            </p>
          </AnimateIn>
          <div className="rounded-xl border border-zinc-800 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-800 bg-zinc-900">
                  <th className="text-left px-6 py-3 text-xs font-medium text-zinc-500 uppercase tracking-widest w-36">Role</th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-zinc-500 uppercase tracking-widest">Scope of access</th>
                </tr>
              </thead>
              <tbody>
                {ROLES.map((r, i) => (
                  <tr key={r.role} className={`border-b border-zinc-800/60 ${i % 2 === 0 ? "bg-zinc-900/40" : ""}`}>
                    <td className="px-6 py-4">
                      <code className="text-xs font-mono px-2 py-0.5 rounded bg-zinc-800 text-emerald-400">{r.role}</code>
                    </td>
                    <td className="px-6 py-4 text-zinc-400">{r.can}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-zinc-800 px-5 py-20 text-center">
        <AnimateIn>
          <h2 className="text-3xl font-semibold tracking-tighter text-white mb-4">
            Start your first reporting period.
          </h2>
          <p className="text-zinc-400 mb-8 max-w-[45ch] mx-auto">
            Create an organisation, add facilities, invite your team. First calculation in under an hour.
          </p>
          <Link
            href="/sign-up"
            className="inline-flex items-center px-7 py-3 rounded-xl bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-500 transition-colors active:scale-[0.97]"
          >
            Create organisation
          </Link>
        </AnimateIn>
      </section>
    </>
  );
}
