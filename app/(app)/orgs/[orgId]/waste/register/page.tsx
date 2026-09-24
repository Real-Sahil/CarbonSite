export const dynamic = "force-dynamic";

import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Download } from "lucide-react";
import { prisma } from "@/lib/db";
import { AuthError, requireOrgMember, ROLE_GROUPS } from "@/lib/auth/session";
import { loadWasteRegister } from "@/lib/waste/register";

type Search = { period?: string; site?: string; gaps?: string };

const tonnes = new Intl.NumberFormat("en-GB", { maximumFractionDigits: 2 });
const pct = (v: number | null) => (v == null ? "-" : `${Math.round(v * 100)}%`);
const date = (d: Date) => d.toISOString().slice(0, 10);

const TIER_LABEL: Record<string, string> = {
  upper: "Upper tier", lower: "Lower tier", scotland: "SEPA", northern_ireland: "NIEA", unknown: "Unrecognised",
};

export default async function WasteRegisterPage({
  params,
  searchParams,
}: {
  params: Promise<{ orgId: string }>;
  searchParams: Promise<Search>;
}) {
  const { orgId } = await params;
  const sp = await searchParams;
  try {
    await requireOrgMember(orgId, ...ROLE_GROUPS.dataReaders);
  } catch (err) {
    if (err instanceof AuthError) redirect("/sign-in");
    throw err;
  }

  const [facilities, periods, register] = await Promise.all([
    prisma.facility.findMany({ where: { organizationId: orgId }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.reportingPeriod.findMany({ where: { organizationId: orgId }, select: { id: true, label: true }, orderBy: { startDate: "desc" } }),
    loadWasteRegister(orgId, { reportingPeriodId: sp.period || undefined, facilityId: sp.site || undefined, gapsOnly: sp.gaps === "1" }),
  ]);
  const { rows, summary, sites } = register;

  const csvQuery = new URLSearchParams({
    ...(sp.period ? { reportingPeriodId: sp.period } : {}),
    ...(sp.site ? { facilityId: sp.site } : {}),
    ...(sp.gaps === "1" ? { gaps: "1" } : {}),
  }).toString();

  return (
    <div className="p-4 sm:p-8 max-w-6xl mx-auto">
      <Link href={`/orgs/${orgId}/waste`} className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700">
        <ArrowLeft className="h-4 w-4" /> Waste
      </Link>
      <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 tracking-tight">Duty of care register</h1>
          <p className="mt-1 max-w-[65ch] text-sm text-gray-500">
            Every waste transfer with its EWC code, carrier registration and transfer note, checked against the duty of
            care. Keep transfer notes for two years and hazardous consignment notes for three.
          </p>
        </div>
        <a
          href={`/api/orgs/${orgId}/waste-records/register${csvQuery ? `?${csvQuery}` : ""}`}
          className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          <Download className="h-4 w-4" /> Export CSV
        </a>
      </div>

      <dl className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          ["Transfers", String(summary.transfers)],
          ["Complete", summary.transfers ? `${summary.complete} (${pct(summary.complete / summary.transfers)})` : "-"],
          ["With gaps", String(summary.gaps)],
          ["Diverted from landfill", pct(summary.diversionRate)],
        ].map(([label, value]) => (
          <div key={label} className="rounded-lg border border-gray-200 bg-white p-4">
            <dt className="text-xs font-medium text-gray-500">{label}</dt>
            <dd className={`mt-1 text-xl font-semibold tabular-nums ${label === "With gaps" && summary.gaps > 0 ? "text-red-700" : "text-gray-900"}`}>{value}</dd>
          </div>
        ))}
      </dl>

      <form className="mt-6 flex flex-wrap items-end gap-3" method="get">
        <label className="text-xs font-medium text-gray-600">
          <span className="mb-1 block">Reporting period</span>
          <select name="period" defaultValue={sp.period ?? ""} className="h-9 rounded-md border border-gray-200 bg-white px-2 text-sm">
            <option value="">All periods</option>
            {periods.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
          </select>
        </label>
        <label className="text-xs font-medium text-gray-600">
          <span className="mb-1 block">Site</span>
          <select name="site" defaultValue={sp.site ?? ""} className="h-9 rounded-md border border-gray-200 bg-white px-2 text-sm">
            <option value="">All sites</option>
            {facilities.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
          </select>
        </label>
        <label className="flex h-9 items-center gap-2 text-sm text-gray-700">
          <input type="checkbox" name="gaps" value="1" defaultChecked={sp.gaps === "1"} /> Only transfers with gaps
        </label>
        <button type="submit" className="h-9 rounded-md bg-gray-900 px-3 text-sm font-medium text-white hover:bg-gray-800">Apply</button>
      </form>

      {sites.length > 1 && (
        <div className="mt-6 overflow-x-auto rounded-lg border border-gray-200 bg-white">
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-gray-500">
              <tr>
                <th className="px-4 py-2 font-medium">Site</th>
                <th className="px-4 py-2 text-right font-medium">Tonnes</th>
                <th className="px-4 py-2 text-right font-medium">Diverted from landfill</th>
                <th className="px-4 py-2 text-right font-medium">Transfers with gaps</th>
              </tr>
            </thead>
            <tbody className="tabular-nums">
              {sites.map((s) => (
                <tr key={s.name} className="border-t border-gray-100">
                  <td className="px-4 py-2 text-gray-900">{s.name}</td>
                  <td className="px-4 py-2 text-right text-gray-600">{tonnes.format(s.tonnes)}</td>
                  <td className="px-4 py-2 text-right text-gray-600">{pct(s.diversionRate)}</td>
                  <td className={`px-4 py-2 text-right ${s.gaps ? "text-red-700" : "text-gray-600"}`}>{s.gaps} of {s.transfers}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-6 overflow-x-auto rounded-lg border border-gray-200 bg-white">
        {rows.length === 0 ? (
          <p className="p-6 text-sm text-gray-500">
            {summary.transfers === 0 ? "No waste transfers recorded yet. Add them on the Waste page or approve field waste tickets." : "No transfers match these filters."}
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-gray-500">
              <tr>
                <th className="px-4 py-2 font-medium">Date</th>
                <th className="px-4 py-2 font-medium">Site</th>
                <th className="px-4 py-2 font-medium">Waste</th>
                <th className="px-4 py-2 text-right font-medium">Tonnes</th>
                <th className="px-4 py-2 font-medium">Carrier</th>
                <th className="px-4 py-2 font-medium">Note</th>
                <th className="px-4 py-2 font-medium">Keep until</th>
                <th className="px-4 py-2 font-medium">Duty of care</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-gray-100 align-top">
                  <td className="px-4 py-3 whitespace-nowrap tabular-nums text-gray-600">{date(r.recordedAt)}</td>
                  <td className="px-4 py-3 text-gray-900">{r.facility}</td>
                  <td className="px-4 py-3 text-gray-700">
                    {r.wasteType}
                    <span className="block text-xs text-gray-500 tabular-nums">
                      {r.ewc ?? "No EWC code"}{r.hazardous ? " · hazardous" : ""}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-gray-700">{tonnes.format(r.tonnes)}</td>
                  <td className="px-4 py-3 text-gray-700">
                    {r.carrierName ?? "-"}
                    {r.carrierRegistration && (
                      <span className="block text-xs text-gray-500">
                        {r.carrierRegistration}
                        {r.check.carrier.tier ? ` · ${TIER_LABEL[r.check.carrier.tier]}` : ""}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-700">{r.transferNoteReference ?? "-"}</td>
                  <td className="px-4 py-3 whitespace-nowrap tabular-nums text-gray-600">{date(r.check.keepUntil)}</td>
                  <td className="px-4 py-3 min-w-[16rem]">
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                        r.check.complete
                          ? r.check.issues.length ? "bg-amber-100 text-amber-800" : "bg-green-100 text-green-800"
                          : "bg-red-100 text-red-800"
                      }`}
                    >
                      {r.check.complete ? (r.check.issues.length ? "Complete, check notes" : "Complete") : "Gaps"}
                    </span>
                    {r.check.issues.length > 0 && (
                      <ul className="mt-1 space-y-0.5 text-xs text-gray-600">
                        {r.check.issues.map((i) => (
                          <li key={i.code} className={i.level === "error" ? "text-red-700" : undefined}>{i.message}</li>
                        ))}
                      </ul>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      {summary.truncated && (
        <p className="mt-2 text-xs text-gray-500">Showing the newest 2,000 transfers. Filter by period or site, or export CSV for everything.</p>
      )}
    </div>
  );
}
