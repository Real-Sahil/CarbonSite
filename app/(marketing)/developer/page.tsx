import { Key, Lock, Zap, Globe, BookOpen } from "lucide-react";
import Link from "next/link";

const ENDPOINTS = [
  {
    group: "Activity Records",
    endpoints: [
      { method: "GET",    path: "/api/orgs/{orgId}/activity-records",       desc: "List activity records with cursor pagination, filtering by period, category, status." },
      { method: "POST",   path: "/api/orgs/{orgId}/activity-records",       desc: "Create a committed activity record." },
      { method: "GET",    path: "/api/orgs/{orgId}/activity-records/{id}",  desc: "Retrieve a single record with full detail." },
      { method: "PATCH",  path: "/api/orgs/{orgId}/activity-records/{id}",  desc: "Update a record (admin/editor only)." },
      { method: "DELETE", path: "/api/orgs/{orgId}/activity-records/{id}",  desc: "Soft-delete a record." },
    ],
  },
  {
    group: "Imports",
    endpoints: [
      { method: "GET",  path: "/api/orgs/{orgId}/imports",           desc: "List import batches." },
      { method: "POST", path: "/api/orgs/{orgId}/imports",           desc: "Upload a CSV/XLSX/PDF for processing." },
      { method: "GET",  path: "/api/orgs/{orgId}/imports/{importId}",desc: "Poll import status (uploaded/parsing/ready/committed/failed)." },
      { method: "POST", path: "/api/orgs/{orgId}/imports/{importId}/commit", desc: "Commit a validated import batch." },
    ],
  },
  {
    group: "Calculation Runs",
    endpoints: [
      { method: "GET",  path: "/api/orgs/{orgId}/calculation-runs",      desc: "List runs for a reporting period." },
      { method: "POST", path: "/api/orgs/{orgId}/calculation-runs",      desc: "Trigger a new calculation run." },
      { method: "GET",  path: "/api/orgs/{orgId}/calculation-runs/{id}", desc: "Get run status and summary totals." },
    ],
  },
  {
    group: "Reports",
    endpoints: [
      { method: "GET",  path: "/api/orgs/{orgId}/reports",       desc: "List generated reports." },
      { method: "POST", path: "/api/orgs/{orgId}/reports",       desc: "Trigger report generation from a published snapshot." },
      { method: "GET",  path: "/api/orgs/{orgId}/reports/{id}",  desc: "Get report status and 15-minute signed download URL." },
    ],
  },
  {
    group: "Field Submissions",
    endpoints: [
      { method: "GET",  path: "/api/orgs/{orgId}/field-submissions",       desc: "List pending and reviewed submissions." },
      { method: "POST", path: "/api/orgs/{orgId}/field-submissions",       desc: "Submit a field data record (field_worker role)." },
      { method: "PATCH",path: "/api/orgs/{orgId}/field-submissions/{id}",  desc: "Review: approve, reject, or request more info." },
    ],
  },
  {
    group: "Carbon Offsets",
    endpoints: [
      { method: "GET",    path: "/api/orgs/{orgId}/offsets",      desc: "List purchased carbon credits with total tonnes." },
      { method: "POST",   path: "/api/orgs/{orgId}/offsets",      desc: "Record a new carbon credit purchase." },
      { method: "DELETE", path: "/api/orgs/{orgId}/offsets/{id}", desc: "Remove an offset record." },
    ],
  },
  {
    group: "Insights",
    endpoints: [
      { method: "GET", path: "/api/orgs/{orgId}/insights", desc: "Rule-based carbon insights: net position, scope split, target gap, offset coverage." },
    ],
  },
  {
    group: "Audit Log",
    endpoints: [
      { method: "GET", path: "/api/orgs/{orgId}/audit-logs",        desc: "Paginated audit log with filters (admin/auditor only)." },
      { method: "GET", path: "/api/orgs/{orgId}/audit-logs/export", desc: "Export audit log as CSV or JSON (max 10k rows)." },
    ],
  },
];

const METHOD_COLORS: Record<string, string> = {
  GET:    "bg-sky-100 text-sky-700",
  POST:   "bg-green-100 text-green-700",
  PATCH:  "bg-amber-100 text-amber-700",
  DELETE: "bg-red-100 text-red-600",
};

export default function DeveloperPage() {
  return (
    <main className="min-h-[100dvh] bg-gray-950">
      {/* Header */}
      <div className="border-b border-gray-800 bg-gray-950 sticky top-0 z-10">
        <div className="mx-auto max-w-6xl px-6 h-16 flex items-center justify-between">
          <Link href="/" className="text-sm font-semibold text-white">CarbonSite</Link>
          <Link
            href="/sign-up"
            className="rounded-lg bg-sky-500 px-4 py-1.5 text-xs font-medium text-white hover:bg-sky-400 transition-colors"
          >
            Get API key
          </Link>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-6 py-16">
        {/* Hero */}
        <div className="mb-14">
          <div className="inline-flex items-center gap-2 rounded-full border border-sky-500/30 bg-sky-500/10 px-3 py-1 text-xs text-sky-400 mb-6">
            <Globe className="h-3 w-3" />
            REST API — v1
          </div>
          <h1 className="text-4xl md:text-5xl font-semibold tracking-tighter text-white mb-4">
            CarbonSite API
          </h1>
          <p className="text-base text-gray-400 leading-relaxed max-w-[60ch]">
            Integrate carbon accounting data into your ERP, dashboards, and workflows.
            All endpoints return JSON and require a bearer token.
          </p>
        </div>

        {/* Quick start */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-14">
          {[
            { icon: Key,      title: "API Keys",       desc: "Generate keys in Settings > API Keys. Keys are prefixed csk_ and shown once." },
            { icon: Lock,     title: "Authentication", desc: "Pass Authorization: Bearer csk_... on every request. Keys are org-scoped." },
            { icon: Zap,      title: "Rate limits",    desc: "Read: 300 req/min. Mutations: 60 req/min. Uploads: 10 req/min per IP." },
          ].map(({ icon: Icon, title, desc }) => (
            <div key={title} className="rounded-xl border border-gray-800 bg-gray-900 p-5">
              <div className="h-8 w-8 rounded-lg bg-sky-500/15 flex items-center justify-center mb-3">
                <Icon className="h-4 w-4 text-sky-400" />
              </div>
              <p className="text-sm font-semibold text-white mb-1.5">{title}</p>
              <p className="text-xs text-gray-400 leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>

        {/* Base URL */}
        <div className="rounded-xl border border-gray-800 bg-gray-900 p-5 mb-8 font-mono text-sm">
          <p className="text-xs text-gray-500 mb-2 uppercase tracking-wide">Base URL</p>
          <p className="text-green-400">https://app.carbonsite.io</p>
        </div>

        {/* Example request */}
        <div className="rounded-xl border border-gray-800 bg-gray-900 p-5 mb-14 overflow-x-auto">
          <p className="text-xs text-gray-500 mb-3 uppercase tracking-wide">Example</p>
          <pre className="text-sm text-gray-300 whitespace-pre">{`curl -X GET "https://app.carbonsite.io/api/orgs/{orgId}/activity-records" \\
  -H "Authorization: Bearer csk_your_api_key_here" \\
  -H "Content-Type: application/json"`}</pre>
        </div>

        {/* Endpoint reference */}
        <div className="flex items-center gap-3 mb-6">
          <BookOpen className="h-4 w-4 text-gray-400" />
          <h2 className="text-lg font-semibold text-white">Endpoint reference</h2>
        </div>

        <div className="space-y-8">
          {ENDPOINTS.map((group) => (
            <div key={group.group}>
              <h3 className="text-xs font-semibold uppercase tracking-widest text-gray-500 mb-3">{group.group}</h3>
              <div className="rounded-xl border border-gray-800 bg-gray-900 overflow-hidden">
                <table className="w-full text-sm">
                  <tbody className="divide-y divide-gray-800">
                    {group.endpoints.map((ep) => (
                      <tr key={ep.path + ep.method} className="hover:bg-gray-800/50 transition-colors">
                        <td className="py-3 pl-5 pr-4 w-20 shrink-0">
                          <span className={`inline-block rounded-md px-2 py-0.5 text-xs font-semibold font-mono ${METHOD_COLORS[ep.method] ?? "bg-gray-700 text-gray-300"}`}>
                            {ep.method}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-mono text-xs text-sky-400 whitespace-nowrap">{ep.path}</td>
                        <td className="py-3 pl-4 pr-5 text-xs text-gray-400">{ep.desc}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>

        {/* Response format */}
        <div className="mt-14 rounded-xl border border-gray-800 bg-gray-900 p-6">
          <h3 className="text-sm font-semibold text-white mb-4">Response format</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">Success — paginated list</p>
              <pre className="text-xs text-gray-300 bg-gray-950 rounded-lg p-3 overflow-x-auto">{`{
  "data": [...],
  "nextCursor": "2026-08-01T00:00:00.000Z"
}`}</pre>
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">Error</p>
              <pre className="text-xs text-gray-300 bg-gray-950 rounded-lg p-3 overflow-x-auto">{`{
  "code": "VALIDATION_ERROR",
  "message": "Invalid query parameters",
  "details": { ... }
}`}</pre>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
