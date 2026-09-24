export const dynamic = "force-dynamic";

import { AuthError, requireOrgMember } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { redirect } from "next/navigation";
import type { OrgRole } from "@prisma/client";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Zap, AlertTriangle, Radio, Plug, ChevronRight } from "lucide-react";

interface Props {
  params: Promise<{ orgId: string }>;
}

const VIEW_ROLES: OrgRole[] = [
  "admin", "sustainability_director", "sustainability_manager",
  "editor", "reviewer", "viewer", "auditor",
];

const SEVERITY_VARIANTS: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  low: "outline",
  medium: "secondary",
  high: "default",
  critical: "destructive",
};

const SEVERITY_ORDER = ["critical", "high", "medium", "low"];

export default async function CarbonIntelligencePage({ params }: Props) {
  const { orgId } = await params;

  let role: OrgRole;
  try {
    const result = await requireOrgMember(orgId, ...VIEW_ROLES);
    role = result.membership.role;
  } catch (err) {
    if (err instanceof AuthError) {
      if (err.status === 401) redirect("/sign-in");
      return <AccessDenied />;
    }
    throw err;
  }

  const isAdmin = role === "admin" || role === "sustainability_director";

  const [openAlerts, recentSignals, activeCreds, alertSeverity] = await Promise.all([
    prisma.impactAlert.findMany({
      where: { organizationId: orgId, resolvedAt: null },
      orderBy: { createdAt: "desc" },
      take: 8,
      select: {
        id: true, alertType: true, severity: true,
        title: true, createdAt: true, message: true,
      },
    }),
    prisma.carbonSignal.findMany({
      where: { organizationId: orgId },
      orderBy: { recordedAt: "desc" },
      take: 8,
      select: {
        id: true, signalType: true, source: true,
        region: true, value: true, unit: true, recordedAt: true,
      },
    }),
    prisma.externalApiCredential.count({ where: { organizationId: orgId, isActive: true } }),
    prisma.impactAlert.groupBy({
      by: ["severity"],
      where: { organizationId: orgId, resolvedAt: null },
      _count: { _all: true },
    }),
  ]);

  const severityMap = Object.fromEntries(alertSeverity.map((r) => [r.severity, r._count._all]));
  const criticalCount = severityMap.critical ?? 0;
  const highCount = severityMap.high ?? 0;

  return (
    <div className="min-h-[100dvh] bg-[#F9FAFB]">
      <div className="bg-white border-b border-[#E5E7EB]">
        <div className="max-w-[1200px] mx-auto px-4 sm:px-8 py-8">
          <div className="flex items-center gap-2 mb-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#EFF6FF]">
              <Zap className="h-4 w-4 text-[#111827]" />
            </div>
            <span className="text-xs font-medium tracking-wide text-[#111827] uppercase">Carbon Intelligence</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-[#111827]">Overview</h1>
          <p className="mt-1 text-sm text-[#374151] max-w-[65ch]">
            Real-time carbon signals, threshold alerts, and external data integrations.
          </p>

          <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div className="rounded-lg border border-[#E5E7EB] bg-white px-4 py-4 flex flex-col gap-1">
              <span className="text-2xl font-bold tabular-nums text-[#111827]">{openAlerts.length}</span>
              <span className="text-xs text-[#6B7280]">open alerts</span>
            </div>
            <div className="rounded-lg border border-[#E5E7EB] bg-white px-4 py-4 flex flex-col gap-1">
              <span className={`text-2xl font-bold tabular-nums ${criticalCount > 0 ? "text-red-600" : "text-[#111827]"}`}>
                {criticalCount}
              </span>
              <span className="text-xs text-[#6B7280]">critical severity</span>
            </div>
            <div className="rounded-lg border border-[#E5E7EB] bg-white px-4 py-4 flex flex-col gap-1">
              <span className="text-2xl font-bold tabular-nums text-[#111827]">{recentSignals.length ? "Active" : "None"}</span>
              <span className="text-xs text-[#6B7280]">recent signals</span>
            </div>
            <div className="rounded-lg border border-[#E5E7EB] bg-white px-4 py-4 flex flex-col gap-1">
              <span className="text-2xl font-bold tabular-nums text-[#111827]">{activeCreds}</span>
              <span className="text-xs text-[#6B7280]">active integrations</span>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-[1200px] mx-auto px-4 sm:px-8 py-8 grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Open alerts */}
        <Card className="border-[#E5E7EB] shadow-none">
          <CardHeader className="px-6 py-4 border-b border-[#E5E7EB]">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-sm font-semibold text-[#111827] flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-[#c2410c]" />
                  Open Alerts
                  {(criticalCount + highCount) > 0 && (
                    <Badge variant="destructive" className="text-xs ml-1">
                      {criticalCount + highCount} urgent
                    </Badge>
                  )}
                </CardTitle>
                <CardDescription className="text-xs text-[#6B7280] mt-0.5">
                  Unresolved threshold breaches and anomalies.
                </CardDescription>
              </div>
              <Link href={`/orgs/${orgId}/carbon-intelligence/alerts`} className="text-xs text-[#374151] hover:underline flex items-center gap-1">
                All alerts <ChevronRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </CardHeader>
          <CardContent className={openAlerts.length === 0 ? "py-8" : "p-0"}>
            {openAlerts.length === 0 ? (
              <div className="text-center">
                <p className="text-xs text-[#6B7280]">No open alerts. All clear.</p>
              </div>
            ) : (
              <ul className="divide-y divide-[#F3F4F6]">
                {openAlerts.map((a) => (
                  <li key={a.id} className="flex items-start gap-3 px-6 py-3 hover:bg-[#F9FAFB]">
                    <Badge
                      variant={SEVERITY_VARIANTS[a.severity] ?? "outline"}
                      className="text-xs mt-0.5 flex-shrink-0 capitalize"
                    >
                      {a.severity}
                    </Badge>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-[#111827] truncate">{a.title}</p>
                      <p className="text-xs text-[#6B7280] truncate">{a.alertType}</p>
                    </div>
                    <span className="text-xs text-[#6B7280] flex-shrink-0 tabular-nums">
                      {new Date(a.createdAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Recent signals */}
        <Card className="border-[#E5E7EB] shadow-none">
          <CardHeader className="px-6 py-4 border-b border-[#E5E7EB]">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-sm font-semibold text-[#111827] flex items-center gap-2">
                  <Radio className="h-4 w-4 text-[#6366f1]" />
                  Carbon Signals
                </CardTitle>
                <CardDescription className="text-xs text-[#6B7280] mt-0.5">
                  Recent real-time or near-real-time data ingested.
                </CardDescription>
              </div>
              <Link href={`/orgs/${orgId}/carbon-intelligence/signals`} className="text-xs text-[#374151] hover:underline flex items-center gap-1">
                All signals <ChevronRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </CardHeader>
          <CardContent className={recentSignals.length === 0 ? "py-8" : "p-0"}>
            {recentSignals.length === 0 ? (
              <div className="text-center">
                <p className="text-xs text-[#6B7280]">No signals ingested yet.</p>
              </div>
            ) : (
              <ul className="divide-y divide-[#F3F4F6]">
                {recentSignals.map((s) => (
                  <li key={s.id} className="flex items-center gap-3 px-6 py-3 hover:bg-[#F9FAFB]">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-[#111827] truncate">{s.signalType}</p>
                      <p className="text-xs text-[#6B7280]">{s.source}{s.region ? ` · ${s.region}` : ""}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-sm font-semibold text-[#111827] tabular-nums">
                        {Number(s.value).toLocaleString("en-GB", { maximumFractionDigits: 3 })} {s.unit}
                      </p>
                      <p className="text-xs text-[#6B7280] tabular-nums">
                        {new Date(s.recordedAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Integrations card */}
        {isAdmin && (
          <Card className="border-[#E5E7EB] shadow-none lg:col-span-2">
            <CardHeader className="px-6 py-4 border-b border-[#E5E7EB]">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-sm font-semibold text-[#111827] flex items-center gap-2">
                    <Plug className="h-4 w-4 text-[#6B7280]" />
                    External Integrations
                  </CardTitle>
                  <CardDescription className="text-xs text-[#6B7280] mt-0.5">
                    API credentials for external data sources.
                  </CardDescription>
                </div>
                <Link href={`/orgs/${orgId}/carbon-intelligence/integrations`} className="text-xs text-[#374151] hover:underline flex items-center gap-1">
                  Manage <ChevronRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            </CardHeader>
            <CardContent className="px-6 py-5">
              <div className="flex items-center gap-3">
                <div className={`h-2.5 w-2.5 rounded-full flex-shrink-0 ${activeCreds > 0 ? "bg-emerald-500" : "bg-[#E5E7EB]"}`} />
                <p className="text-sm text-[#374151]">
                  {activeCreds > 0
                    ? `${activeCreds} active integration${activeCreds !== 1 ? "s" : ""} configured.`
                    : "No integrations configured. Connect an external data source to start ingesting carbon signals automatically."}
                </p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

function AccessDenied() {
  return (
    <div className="p-8">
      <p className="text-sm text-red-600">You do not have permission to view Carbon Intelligence.</p>
    </div>
  );
}
