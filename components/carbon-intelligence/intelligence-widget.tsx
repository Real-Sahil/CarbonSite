import Link from "next/link";
import type { OrgRole } from "@prisma/client";
import { Zap, ChevronRight } from "lucide-react";
import { prisma } from "@/lib/db";

const SIGNAL_WINDOW_DAYS = 7;
const ADMIN_ROLES: OrgRole[] = ["admin", "sustainability_director"];

/**
 * Dashboard widget: the Carbon Intelligence summary (open impact alerts, critical
 * and high counts, signals in the last seven days, active integrations). The same
 * counts the Carbon Intelligence overview shows, read for this organisation only.
 */
export async function CarbonIntelligenceWidget({ orgId, role }: { orgId: string; role: OrgRole }) {
  const since = new Date(Date.now() - SIGNAL_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const [alertSeverity, recentSignals, activeCreds] = await Promise.all([
    prisma.impactAlert.groupBy({
      by: ["severity"],
      where: { organizationId: orgId, resolvedAt: null },
      _count: { _all: true },
    }),
    prisma.carbonSignal.count({ where: { organizationId: orgId, recordedAt: { gte: since } } }),
    prisma.externalApiCredential.count({ where: { organizationId: orgId, isActive: true } }),
  ]);

  const severity = Object.fromEntries(alertSeverity.map((r) => [r.severity, r._count._all]));
  const openAlerts = alertSeverity.reduce((sum, r) => sum + r._count._all, 0);
  const critical = severity.critical ?? 0;
  const high = severity.high ?? 0;
  const canManageIntegrations = ADMIN_ROLES.includes(role);

  return (
    <section aria-label="Carbon intelligence" className="mt-6">
      <div className="rounded-lg border border-[#E3E8EE] bg-white">
        <div className="flex items-center justify-between gap-3 border-b border-[#E3E8EE] px-5 py-4">
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-[#131d29]" aria-hidden="true" />
            <div>
              <p className="text-sm font-semibold text-[#131d29]">Carbon intelligence</p>
              <p className="text-xs text-[#5B6A78]">Threshold alerts and incoming carbon signals for this organisation.</p>
            </div>
          </div>
          <Link
            href={`/orgs/${orgId}/carbon-intelligence`}
            className="flex items-center gap-1 text-xs text-[#41505F] hover:underline"
          >
            Open overview <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
          </Link>
        </div>
        <div className="grid grid-cols-2 gap-4 px-5 py-5 sm:grid-cols-4">
          <Stat value={openAlerts} label="open alerts" href={`/orgs/${orgId}/carbon-intelligence/alerts`} />
          <Stat value={critical} label="critical" alarm={critical > 0} />
          <Stat value={high} label="high severity" alarm={high > 0} />
          <Stat value={recentSignals} label={`signals, last ${SIGNAL_WINDOW_DAYS} days`} href={`/orgs/${orgId}/carbon-intelligence/signals`} />
        </div>
        <p className="border-t border-[#E3E8EE] px-5 py-3 text-xs text-[#5B6A78]">
          {openAlerts === 0 && recentSignals === 0
            ? "No open alerts and no signals this week."
            : "Open alerts are unresolved threshold breaches and anomalies."}
          {" "}
          {canManageIntegrations ? (
            <>
              {activeCreds > 0
                ? `${activeCreds} active integration${activeCreds !== 1 ? "s" : ""}. `
                : "No integrations connected. "}
              <Link href={`/orgs/${orgId}/carbon-intelligence/integrations`} className="underline underline-offset-2 hover:text-[#131d29]">
                Manage integrations
              </Link>
            </>
          ) : (
            `${activeCreds} active integration${activeCreds !== 1 ? "s" : ""}.`
          )}
        </p>
      </div>
    </section>
  );
}

function Stat({ value, label, href, alarm }: { value: number; label: string; href?: string; alarm?: boolean }) {
  const body = (
    <>
      <span className={`text-2xl font-bold tabular-nums ${alarm ? "text-red-600" : "text-[#131d29]"}`}>
        {value.toLocaleString("en-GB")}
      </span>
      <span className="text-xs text-[#5B6A78]">{label}</span>
    </>
  );
  return href ? (
    <Link href={href} className="flex flex-col gap-1 rounded-lg hover:bg-[#F9FAFC]">{body}</Link>
  ) : (
    <div className="flex flex-col gap-1">{body}</div>
  );
}
