export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { BarChart3, Trash2 } from "lucide-react";
import { prisma } from "@/lib/db";
import { requireOrgMember, AuthError } from "@/lib/auth/session";
import { WasteAddButtons, DeleteWasteButton, DISPOSAL_ROUTES } from "./waste-actions";

const HIERARCHY_COLORS: Record<string, string> = {
  recycle:  "bg-green-100 text-green-700",
  recovery: "bg-amber-100 text-amber-700",
  landfill: "bg-red-100 text-red-700",
};

export default async function WastePage({ params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params;

  let canEdit = false;
  try {
    const result = await requireOrgMember(orgId, "admin", "editor", "reviewer", "viewer", "auditor");
    canEdit = ["admin", "editor"].includes(result.membership.role);
  } catch (err) {
    if (err instanceof AuthError) redirect("/sign-in");
    throw err;
  }

  const [rawRecords, facilities, rawPeriods] = await Promise.all([
    prisma.wasteRecord.findMany({
      where: { organizationId: orgId },
      orderBy: { recordedAt: "desc" },
      take: 200,
      select: {
        id: true, wasteType: true, disposalRoute: true, hazardous: true,
        weightTonnes: true, co2eTonnes: true, ewcCode: true, carrierName: true,
        recordedAt: true,
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
    weightTonnes: Number(r.weightTonnes),
    co2eTonnes: r.co2eTonnes != null ? Number(r.co2eTonnes) : null,
    recordedAt: r.recordedAt.toISOString(),
  }));

  const totalWeight = records.reduce((s, r) => s + r.weightTonnes, 0);
  const totalCo2e = records.reduce((s, r) => s + (r.co2eTonnes ?? 0), 0);

  const byHierarchy = records.reduce<Record<string, { weight: number; co2e: number }>>((acc, r) => {
    const route = DISPOSAL_ROUTES.find((d) => d.value === r.disposalRoute);
    const h = route?.hierarchy ?? "landfill";
    if (!acc[h]) acc[h] = { weight: 0, co2e: 0 };
    acc[h].weight += r.weightTonnes;
    acc[h].co2e += r.co2eTonnes ?? 0;
    return acc;
  }, {});

  const recycledPct = totalWeight > 0
    ? Math.round(((byHierarchy.recycle?.weight ?? 0) / totalWeight) * 100)
    : 0;
  const hazardousTonnes = records.filter((r) => r.hazardous).reduce((s, r) => s + r.weightTonnes, 0);

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 tracking-tight">Waste Emissions</h1>
          <p className="text-sm text-gray-500 mt-1">Track waste disposal routes for ESRS E5 and Scope 3 Category 5 emissions.</p>
        </div>
        {canEdit && <WasteAddButtons orgId={orgId} facilities={facilities} periods={rawPeriods} />}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
        {[
          { label: "Total waste",          value: totalWeight.toFixed(2),        unit: "tonnes" },
          { label: "Total emissions",      value: totalCo2e.toFixed(3),          unit: "tCO2e" },
          { label: "Recycled / diverted",  value: `${recycledPct}%`,             unit: "of waste weight" },
          { label: "Hazardous",            value: hazardousTonnes.toFixed(2),    unit: "tonnes" },
          { label: "Records",              value: records.length.toString(),      unit: "waste records" },
        ].map(({ label, value, unit }) => (
          <div key={label} className="rounded-xl border border-gray-200 bg-white p-5">
            <div className="text-xs font-medium text-gray-500 uppercase tracking-widest mb-1">{label}</div>
            <div className="text-2xl font-semibold text-gray-900 tabular-nums">{value}</div>
            <div className="text-xs text-gray-500 mt-0.5">{unit}</div>
          </div>
        ))}
      </div>

      {records.length > 0 && (
        <div className="rounded-xl border border-gray-200 bg-white p-5 mb-6">
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 className="h-4 w-4 text-gray-500" />
            <h3 className="text-sm font-semibold text-gray-900">Waste hierarchy</h3>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {[
              { key: "recycle",  label: "Recycled / Composted",     cls: "bg-green-50 border-green-200" },
              { key: "recovery", label: "Energy Recovery (EfW)",    cls: "bg-amber-50 border-amber-200" },
              { key: "landfill", label: "Landfill / Disposal",      cls: "bg-red-50 border-red-200" },
            ].map(({ key, label, cls }) => {
              const data = byHierarchy[key];
              const pct = totalWeight > 0 ? Math.round(((data?.weight ?? 0) / totalWeight) * 100) : 0;
              return (
                <div key={key} className={`rounded-lg border p-4 ${cls}`}>
                  <p className="text-xs font-medium text-gray-600 mb-1">{label}</p>
                  <p className="text-xl font-semibold text-gray-900 tabular-nums">{pct}%</p>
                  <p className="text-xs text-gray-500">{(data?.weight ?? 0).toFixed(2)} t</p>
                  <p className="text-xs text-gray-500">{(data?.co2e ?? 0).toFixed(4)} tCO2e</p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
        {records.length === 0 ? (
          <div className="p-12 text-center">
            <div className="mx-auto mb-3 h-10 w-10 rounded-full bg-gray-50 flex items-center justify-center">
              <Trash2 className="h-5 w-5 text-gray-500" />
            </div>
            <p className="text-sm font-medium text-gray-700">No waste records</p>
            <p className="text-xs text-gray-500 mt-1">Add your first waste disposal record to start tracking emissions.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b border-gray-100">
              <tr>
                {["Waste type", "Facility", "Disposal route", "Weight (t)", "CO2e (tCO2e)", "Date", "EWC", ""].map((h) => (
                  <th key={h} className="py-3 px-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide first:pl-6 last:pr-6">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {records.map((r) => {
                const route = DISPOSAL_ROUTES.find((d) => d.value === r.disposalRoute);
                const hierarchyColor = HIERARCHY_COLORS[route?.hierarchy ?? "landfill"] ?? "";
                return (
                  <tr key={r.id} className="hover:bg-gray-50 transition-colors">
                    <td className="py-3 pl-6 pr-4 font-medium text-gray-900 max-w-[180px] truncate">
                      {r.wasteType}
                      {r.hazardous && <span className="ml-1.5 rounded-full bg-red-100 px-1.5 py-0.5 text-[10px] font-medium text-red-700">Hazardous</span>}
                    </td>
                    <td className="py-3 px-4 text-gray-600">{r.facility?.name ?? "-"}</td>
                    <td className="py-3 px-4">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${hierarchyColor}`}>
                        {route?.label ?? r.disposalRoute}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-gray-900 tabular-nums">{r.weightTonnes.toFixed(3)}</td>
                    <td className="py-3 px-4 text-gray-600 tabular-nums">
                      {r.co2eTonnes != null ? r.co2eTonnes.toFixed(4) : "-"}
                    </td>
                    <td className="py-3 px-4 text-gray-500 tabular-nums">
                      {new Date(r.recordedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                    </td>
                    <td className="py-3 px-4 text-gray-500 font-mono text-xs">{r.ewcCode ?? "-"}</td>
                    <td className="py-3 pl-4 pr-6">
                      {canEdit && <DeleteWasteButton orgId={orgId} id={r.id} />}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
