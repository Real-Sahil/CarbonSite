export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { Droplets } from "lucide-react";
import { prisma } from "@/lib/db";
import { requireOrgMember, ROLE_GROUPS, AuthError } from "@/lib/auth/session";
import { WaterAddButtons, DeleteWaterButton, SOURCE_OPTIONS } from "./water-actions";

const METRIC_LABELS: Record<string, string> = {
  withdrawal: "Withdrawal",
  discharge:  "Discharge",
  consumption: "Consumption",
};

export default async function WaterPage({ params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params;

  let canEdit = false;
  try {
    const result = await requireOrgMember(orgId, ...ROLE_GROUPS.dataReaders);
    canEdit = ["admin", "editor"].includes(result.membership.role);
  } catch (err) {
    if (err instanceof AuthError) redirect("/sign-in");
    throw err;
  }

  const [rawRecords, facilities, rawPeriods] = await Promise.all([
    prisma.waterRecord.findMany({
      where: { organizationId: orgId },
      orderBy: { recordedAt: "desc" },
      take: 200,
      select: {
        id: true, metricType: true, source: true, volumeM3: true,
        isWaterStressedArea: true, recordedAt: true, notes: true,
        facility: { select: { id: true, name: true } },
      },
    }),
    prisma.facility.findMany({
      where: { organizationId: orgId },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.reportingPeriod.findMany({
      where: { organizationId: orgId },
      select: { id: true, label: true },
      orderBy: { startDate: "desc" },
    }),
  ]);

  const records = rawRecords.map((r) => ({
    ...r,
    volumeM3: Number(r.volumeM3),
    recordedAt: r.recordedAt.toISOString(),
  }));

  const totals = records.reduce<Record<string, number>>((acc, r) => {
    acc[r.metricType] = (acc[r.metricType] ?? 0) + r.volumeM3;
    return acc;
  }, {});

  const stressedM3 = records
    .filter((r) => r.isWaterStressedArea && r.metricType === "withdrawal")
    .reduce((s, r) => s + r.volumeM3, 0);
  const withdrawalM3 = totals.withdrawal ?? 0;
  const stressedPct = withdrawalM3 > 0 ? Math.round((stressedM3 / withdrawalM3) * 100) : 0;

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 tracking-tight">Water</h1>
          <p className="text-sm text-gray-500 mt-1">Track withdrawal, discharge and consumption for CSRD ESRS E3.</p>
        </div>
        {canEdit && <WaterAddButtons orgId={orgId} facilities={facilities} periods={rawPeriods} />}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {[
          { label: "Withdrawal",               value: (totals.withdrawal ?? 0).toFixed(1),  unit: "m3" },
          { label: "Discharge",                value: (totals.discharge ?? 0).toFixed(1),   unit: "m3" },
          { label: "Consumption",              value: (totals.consumption ?? 0).toFixed(1), unit: "m3" },
          { label: "In water-stressed areas",  value: `${stressedPct}%`,                    unit: "of withdrawal" },
        ].map(({ label, value, unit }) => (
          <div key={label} className="rounded-xl border border-gray-200 bg-white p-5">
            <div className="text-xs font-medium text-gray-500 uppercase tracking-widest mb-1">{label}</div>
            <div className="text-2xl font-semibold text-gray-900 tabular-nums">{value}</div>
            <div className="text-xs text-gray-500 mt-0.5">{unit}</div>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
        {records.length === 0 ? (
          <div className="p-12 text-center">
            <div className="mx-auto mb-3 h-10 w-10 rounded-full bg-gray-50 flex items-center justify-center">
              <Droplets className="h-5 w-5 text-gray-500" />
            </div>
            <p className="text-sm font-medium text-gray-700">No water records</p>
            <p className="text-xs text-gray-500 mt-1">Add your first water record to start tracking ESRS E3 disclosures.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b border-gray-100">
              <tr>
                {["Metric", "Facility", "Source", "Volume (m3)", "Water-stressed", "Date", ""].map((h) => (
                  <th key={h} className="py-3 px-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide first:pl-6 last:pr-6">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {records.map((r) => (
                <tr key={r.id} className="hover:bg-gray-50 transition-colors">
                  <td className="py-3 pl-6 pr-4 font-medium text-gray-900">{METRIC_LABELS[r.metricType] ?? r.metricType}</td>
                  <td className="py-3 px-4 text-gray-600">{r.facility?.name ?? "-"}</td>
                  <td className="py-3 px-4 text-gray-600">
                    {SOURCE_OPTIONS.find((s) => s.value === r.source)?.label ?? r.source}
                  </td>
                  <td className="py-3 px-4 text-gray-900 tabular-nums">{r.volumeM3.toFixed(3)}</td>
                  <td className="py-3 px-4">
                    {r.isWaterStressedArea ? (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">Stressed</span>
                    ) : (
                      <span className="text-xs text-gray-500">-</span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-gray-500 tabular-nums">
                    {new Date(r.recordedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                  </td>
                  <td className="py-3 pl-4 pr-6">
                    {canEdit && <DeleteWaterButton orgId={orgId} id={r.id} />}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
