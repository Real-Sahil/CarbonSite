import type { Metadata } from "next";
import Link from "next/link";
import { SiteNav } from "@/components/marketing/site-nav";
import { SiteFooter } from "@/components/marketing/site-footer";
import { AnimateIn } from "@/components/marketing/animate-in";
import { Key, Lock, Zap, BookOpen, ArrowUpRight } from "lucide-react";

export const metadata: Metadata = {
  title: "Developer - CarbonSite",
  description: "REST API documentation for integrating CarbonSite into your workflows.",
};

const ENDPOINTS = [
  {
    group: "Activity Records",
    endpoints: [
      { method: "GET", path: "/api/orgs/{orgId}/activity-records", desc: "List activity records with cursor pagination, filtering by period, category, status." },
      { method: "POST", path: "/api/orgs/{orgId}/activity-records", desc: "Create a committed activity record." },
      { method: "GET", path: "/api/orgs/{orgId}/activity-records/{id}", desc: "Retrieve a single record with full detail." },
      { method: "PATCH", path: "/api/orgs/{orgId}/activity-records/{id}", desc: "Update a record (admin/editor only)." },
      { method: "DELETE", path: "/api/orgs/{orgId}/activity-records/{id}", desc: "Soft-delete a record." },
    ],
  },
  {
    group: "Imports",
    endpoints: [
      { method: "GET", path: "/api/orgs/{orgId}/imports", desc: "List import batches." },
      { method: "POST", path: "/api/orgs/{orgId}/imports", desc: "Upload a CSV/XLSX/PDF for processing." },
      { method: "GET", path: "/api/orgs/{orgId}/imports/{importId}", desc: "Poll import status (uploaded/parsing/ready/committed/failed)." },
      { method: "POST", path: "/api/orgs/{orgId}/imports/{importId}/commit", desc: "Commit a validated import batch." },
    ],
  },
  {
    group: "Calculation Runs",
    endpoints: [
      { method: "GET", path: "/api/orgs/{orgId}/calculation-runs", desc: "List runs for a reporting period." },
      { method: "POST", path: "/api/orgs/{orgId}/calculation-runs", desc: "Trigger a new calculation run." },
      { method: "GET", path: "/api/orgs/{orgId}/calculation-runs/{id}", desc: "Get run status and summary totals." },
    ],
  },
  {
    group: "Reports",
    endpoints: [
      { method: "GET", path: "/api/orgs/{orgId}/reports", desc: "List generated reports." },
      { method: "POST", path: "/api/orgs/{orgId}/reports", desc: "Trigger report generation from a published snapshot." },
      { method: "GET", path: "/api/orgs/{orgId}/reports/{id}", desc: "Get report status and 15-minute signed download URL." },
    ],
  },
  {
    group: "Field Submissions",
    endpoints: [
      { method: "GET", path: "/api/orgs/{orgId}/field-submissions", desc: "List pending and reviewed submissions." },
      { method: "POST", path: "/api/orgs/{orgId}/field-submissions", desc: "Submit a field data record (field_worker role)." },
      { method: "PATCH", path: "/api/orgs/{orgId}/field-submissions/{id}", desc: "Review: approve, reject, or request more info." },
    ],
  },
  {
    group: "Audit Log",
    endpoints: [
      { method: "GET", path: "/api/orgs/{orgId}/audit-logs", desc: "Paginated audit log with filters (admin/auditor only)." },
      { method: "GET", path: "/api/orgs/{orgId}/audit-logs/export", desc: "Export audit log as CSV or JSON (max 10k rows)." },
    ],
  },
];

const METHOD_COLORS: Record<string, string> = {
  GET: "text-[#0891B2] bg-[#06B6D4]/10 border border-[#06B6D4]/20",
  POST: "text-[#0891B2] bg-[#06B6D4]/10 border border-[#06B6D4]/20",
  PATCH: "text-[#E89B6F] bg-[#E89B6F]/10 border border-[#E89B6F]/20",
  DELETE: "text-[#E05A5A] bg-[#E05A5A]/10 border border-[#E05A5A]/20",
};

export default function DeveloperPage() {
  return (
    <main className="min-h-[100dvh] bg-[#0F172A]">
      <SiteNav theme="dark" />

      {/* Hero */}
      <section className="mx-auto max-w-7xl px-6 md:px-10 py-24">
        <AnimateIn>
          <div className="flex items-center gap-4 mb-8">
            <div className="w-6 h-px bg-[#06B6D4]" />
            <span className="text-xs text-[#06B6D4] tracking-[0.12em] font-medium">REST API v1</span>
          </div>
          <h1 className="text-[clamp(2.8rem,6vw,4.5rem)] font-semibold tracking-[-0.04em] leading-[0.95] text-white mb-4 max-w-[24ch]">
            Integrate CarbonSite into your workflows.
          </h1>
          <p className="text-base text-white/55 leading-relaxed max-w-[50ch]">
            Build carbon accounting data into your ERP, dashboards, and workflows. All endpoints return JSON and require a bearer token.
          </p>
        </AnimateIn>
      </section>

      {/* Quick start */}
      <section className="bg-[#F5F4F0] border-y border-[#E2E8F0]">
        <div className="mx-auto max-w-7xl px-6 md:px-10 py-20">
          <AnimateIn>
            <h2 className="text-lg font-semibold text-[#0F172A] tracking-[-0.02em] mb-10">Getting started</h2>
          </AnimateIn>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-px bg-[#E2E8F0]">
            {[
              { icon: Key, title: "API Keys", desc: "Generate keys in Settings > API Keys. Keys are prefixed csk_ and shown once." },
              { icon: Lock, title: "Authentication", desc: "Pass Authorization: Bearer csk_... on every request. Keys are org-scoped." },
              { icon: Zap, title: "Rate limits", desc: "Read: 300 req/min. Mutations: 60 req/min. Uploads: 10 req/min per IP." },
            ].map(({ icon: Icon, title, desc }) => (
              <div key={title} className="bg-[#F5F4F0] p-8 hover:bg-white transition-colors">
                <Icon className="h-6 w-6 text-[#06B6D4] mb-4" />
                <h3 className="text-sm font-semibold text-[#0F172A] tracking-[-0.02em] mb-2">{title}</h3>
                <p className="text-sm text-[#64748B] leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Base URL */}
      <section className="mx-auto max-w-7xl px-6 md:px-10 py-20">
        <AnimateIn>
          <div className="rounded-lg border border-[#1E293B] bg-[#111110] p-6 mb-12">
            <p className="text-[10px] text-[#64748B] uppercase tracking-[0.1em] mb-3">Base URL</p>
            <p className="font-mono text-base text-[#0891B2]">https://app.carbonsite.io</p>
          </div>

          {/* Example request */}
          <div className="rounded-lg border border-[#1E293B] bg-[#111110] p-6 mb-16 overflow-x-auto">
            <p className="text-[10px] text-[#64748B] uppercase tracking-[0.1em] mb-4">Example request</p>
            <pre className="font-mono text-xs text-[#64748B] whitespace-pre">{`curl -X GET "https://app.carbonsite.io/api/orgs/{orgId}/activity-records" \\
  -H "Authorization: Bearer csk_your_api_key_here" \\
  -H "Content-Type: application/json"`}</pre>
          </div>

          {/* Endpoint reference */}
          <div className="flex items-center gap-3 mb-8">
            <BookOpen className="h-5 w-5 text-[#64748B]" />
            <h2 className="text-lg font-semibold text-white tracking-[-0.02em]">Endpoint reference</h2>
          </div>
        </AnimateIn>

        <div className="space-y-12">
          {ENDPOINTS.map((group) => (
            <div key={group.group}>
              <AnimateIn>
                <div className="text-[10px] font-medium text-[#64748B] uppercase tracking-[0.12em] mb-4">{group.group}</div>
                <div className="border border-[#1E293B] rounded-lg overflow-hidden">
                  <div className="divide-y divide-[#1E293B]">
                    {group.endpoints.map((ep) => (
                      <div key={ep.path + ep.method} className="grid grid-cols-1 md:grid-cols-[80px_220px_1fr] hover:bg-[#111110] transition-colors">
                        <div className="px-6 py-4 border-r border-[#1E293B]">
                          <span className={`inline-block text-xs font-mono font-semibold px-2.5 py-1 rounded ${METHOD_COLORS[ep.method] ?? "text-[#64748B] bg-[#1A1A18] border border-[#1E293B]"}`}>
                            {ep.method}
                          </span>
                        </div>
                        <div className="px-6 py-4 border-r border-[#1E293B] font-mono text-xs text-[#0891B2] whitespace-nowrap overflow-x-auto">{ep.path}</div>
                        <div className="px-6 py-4 text-xs text-[#64748B]">{ep.desc}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </AnimateIn>
            </div>
          ))}
        </div>
      </section>

      {/* Response format */}
      <section className="bg-[#F5F4F0] border-t border-[#E2E8F0]">
        <div className="mx-auto max-w-7xl px-6 md:px-10 py-20">
          <AnimateIn>
            <h2 className="text-lg font-semibold text-[#0F172A] tracking-[-0.02em] mb-8">Response format</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="rounded-lg border border-[#E2E8F0] bg-white p-6">
                <p className="text-xs text-[#64748B] uppercase tracking-[0.1em] mb-4">Success (paginated list)</p>
                <pre className="text-xs text-[#0F172A] bg-[#F5F4F0] rounded p-4 overflow-x-auto font-mono">{`{
  "data": [...],
  "nextCursor": "2026-08-01T00:00:00.000Z"
}`}</pre>
              </div>
              <div className="rounded-lg border border-[#E2E8F0] bg-white p-6">
                <p className="text-xs text-[#64748B] uppercase tracking-[0.1em] mb-4">Error</p>
                <pre className="text-xs text-[#0F172A] bg-[#F5F4F0] rounded p-4 overflow-x-auto font-mono">{`{
  "code": "VALIDATION_ERROR",
  "message": "Invalid query parameters",
  "details": { ... }
}`}</pre>
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
              Ready to build with CarbonSite?
            </h2>
            <Link
              href="/sign-up"
              className="inline-flex items-center gap-2 px-7 py-3.5 rounded-full bg-white text-[#0F172A] text-sm font-medium hover:bg-white/90 transition-colors active:scale-[0.97]"
            >
              Get API key
              <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          </AnimateIn>
        </div>
      </section>

      <SiteFooter />
    </main>
  );
}
