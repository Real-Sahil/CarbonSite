export const dynamic = "force-dynamic";

import Link from "next/link";
import { redirect } from "next/navigation";
import { requirePlatformMember, AuthError } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { ACTIVATION_REPORT_TYPES, growthMetrics } from "@/lib/platform/growth";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const pct = (n: number, d: number) => (d > 0 ? `${Math.round((n / d) * 100)}%` : "-");

export default async function PlatformGrowthPage() {
  try {
    await requirePlatformMember();
  } catch (err) {
    if (err instanceof AuthError) {
      if (err.status === 401) redirect("/sign-in");
      return (
        <div className="p-[42px]">
          <p className="text-red-600 text-sm">Platform access denied.</p>
        </div>
      );
    }
    throw err;
  }

  const orgs = await prisma.organization.findMany({
    select: {
      createdAt: true,
      acquisitionSource: true,
      plan: true,
      isPilot: true,
      _count: {
        select: { reports: { where: { type: { in: [...ACTIVATION_REPORT_TYPES] }, status: "ready" } } },
      },
    },
  });
  const m = growthMetrics(
    orgs.map((o) => ({
      createdAt: o.createdAt,
      acquisitionSource: o.acquisitionSource,
      plan: o.plan,
      isPilot: o.isPilot,
      activationReports: o._count.reports,
    })),
    new Date(),
  );

  const stat = (label: string, value: string, note?: string) => (
    <div className="rounded-[14px] border border-[#E5E7EB] p-[21px]">
      <p className="text-xs uppercase tracking-wide text-[#374151]">{label}</p>
      <p className="mt-2 text-3xl tracking-[-0.4px] text-[#111827] tabular-nums">{value}</p>
      {note ? <p className="mt-1 text-xs text-[#6B7280]">{note}</p> : null}
    </div>
  );

  return (
    <div className="p-[42px] max-w-[1200px] mx-auto flex flex-col gap-[42px]">
      <div>
        <Link href="/platform" className="text-xs text-[#374151] hover:underline">
          &larr; Platform
        </Link>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-[#111827]">Growth</h1>
        <p className="text-sm text-[#374151] mt-[7px] max-w-[65ch]">
          Trials started, trials that generated a Carbon Reduction Plan or SECR report, and paying organisations.
          Source is the sign-up&apos;s ?ref or utm_source, else the referring site; &ldquo;unknown&rdquo; covers
          organisations created before sources were recorded or added from inside the app.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {stat("Trials", m.total.trials.toLocaleString("en-GB"))}
        {stat("Generated a CRP or SECR", m.total.activated.toLocaleString("en-GB"), `${pct(m.total.activated, m.total.trials)} of trials`)}
        {stat("Paying", m.total.paying.toLocaleString("en-GB"), "Starter, Growth or Enterprise; pilots excluded")}
        {stat("Pilots", m.pilots.toLocaleString("en-GB"))}
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold text-zinc-900">Last 12 weeks, by week the organisation was created</h2>
        <div className="rounded-[14px] border border-[#E5E7EB] overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Week starting</TableHead>
                <TableHead className="text-right">Trials</TableHead>
                <TableHead className="text-right">Generated CRP or SECR</TableHead>
                <TableHead className="text-right">Paying</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {[...m.byWeek].reverse().map((w) => (
                <TableRow key={w.weekStart.toISOString()}>
                  <TableCell className="text-sm text-[#111827]">
                    {w.weekStart.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" })}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{w.trials}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {w.activated} <span className="text-xs text-[#6B7280]">{pct(w.activated, w.trials)}</span>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{w.paying}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold text-zinc-900">By source, all time</h2>
        <div className="rounded-[14px] border border-[#E5E7EB] overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Source</TableHead>
                <TableHead className="text-right">Trials</TableHead>
                <TableHead className="text-right">Generated CRP or SECR</TableHead>
                <TableHead className="text-right">Paying</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {m.bySource.map((r) => (
                <TableRow key={r.source}>
                  <TableCell className="font-mono text-xs text-[#111827]">{r.source}</TableCell>
                  <TableCell className="text-right tabular-nums">{r.trials}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {r.activated} <span className="text-xs text-[#6B7280]">{pct(r.activated, r.trials)}</span>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {r.paying} <span className="text-xs text-[#6B7280]">{pct(r.paying, r.trials)}</span>
                  </TableCell>
                </TableRow>
              ))}
              {m.bySource.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="py-6 text-center text-sm text-[#374151]">
                    No organisations yet.
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </div>
      </section>
    </div>
  );
}
