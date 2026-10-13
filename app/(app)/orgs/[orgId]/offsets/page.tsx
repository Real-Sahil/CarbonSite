export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { Leaf, ExternalLink, ShieldCheck } from "lucide-react";
import { prisma } from "@/lib/db";
import { requireOrgMember, ROLE_GROUPS, AuthError } from "@/lib/auth/session";
import { AddOffsetButton, OffsetRowActions, PROJECT_TYPES, STATUS_COLORS } from "./offsets-actions";

export default async function OffsetsPage({ params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params;

  let canEdit = false;
  try {
    const result = await requireOrgMember(orgId, ...ROLE_GROUPS.dataReaders);
    canEdit = ["admin", "editor"].includes(result.membership.role);
  } catch (err) {
    if (err instanceof AuthError) redirect("/sign-in");
    throw err;
  }

  const rawOffsets = await prisma.carbonOffset.findMany({
    where: { organizationId: orgId },
    orderBy: { purchasedAt: "desc" },
    take: 200,
    select: {
      id: true, provider: true, projectName: true, projectType: true,
      standard: true, vintage: true, quantityTonnes: true, pricePerTonne: true,
      currency: true, purchasedAt: true, retirementRef: true,
      retirementVerified: true, retirementVerifiedAt: true, notes: true,
    },
  });

  const offsets = rawOffsets.map((o) => ({
    ...o,
    quantityTonnes: Number(o.quantityTonnes),
    pricePerTonne: o.pricePerTonne != null ? Number(o.pricePerTonne) : null,
    purchasedAt: o.purchasedAt.toISOString(),
    retirementVerifiedAt: o.retirementVerifiedAt ? o.retirementVerifiedAt.toISOString() : null,
  }));

  const totalTonnes = offsets.reduce((s, o) => s + o.quantityTonnes, 0);

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold text-[#131d29] tracking-tight">Carbon Offsets</h1>
          <p className="text-sm text-[#5B6A78] mt-1">
            Track verified carbon credits purchased to offset residual emissions.
          </p>
        </div>
        {canEdit && <AddOffsetButton orgId={orgId} />}
      </div>

      <div className="grid grid-cols-2 gap-4 mb-8">
        <div className="rounded-xl border border-[#E3E8EE] bg-white p-5">
          <div className="text-xs font-medium text-[#5B6A78] uppercase tracking-widest mb-1">Total purchased</div>
          <div className="text-2xl font-semibold text-[#131d29] tabular-nums">{totalTonnes.toFixed(1)}</div>
          <div className="text-xs text-[#5B6A78] mt-0.5">tCO₂e</div>
        </div>
        <div className="rounded-xl border border-[#E3E8EE] bg-white p-5">
          <div className="text-xs font-medium text-[#5B6A78] uppercase tracking-widest mb-1">Projects tracked</div>
          <div className="text-2xl font-semibold text-[#131d29] tabular-nums">{offsets.length}</div>
          <div className="text-xs text-[#5B6A78] mt-0.5">offset records</div>
        </div>
      </div>

      <div className="rounded-xl border border-[#E3E8EE] bg-white overflow-hidden">
        {offsets.length === 0 ? (
          <div className="p-12 text-center">
            <div className="mx-auto mb-3 h-10 w-10 rounded-full bg-green-50 flex items-center justify-center">
              <Leaf className="h-5 w-5 text-green-500" />
            </div>
            <p className="text-sm font-medium text-[#41505F]">No offsets yet</p>
            <p className="text-xs text-[#5B6A78] mt-1">Add your first carbon credit purchase to track net position.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b border-gray-100">
              <tr>
                {["Project", "Type", "Standard", "Vintage", "Quantity (tCO₂e)", "Purchased", "Verified", ""].map((h) => (
                  <th key={h} className="py-3 px-4 text-left text-xs font-semibold text-[#5B6A78] uppercase tracking-wide first:pl-6 last:pr-6">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {offsets.map((o) => (
                <tr key={o.id} className="hover:bg-[#F9FAFC] transition-colors">
                  <td className="py-3 pl-6 pr-4">
                    <p className="font-medium text-[#131d29] truncate max-w-[200px]">{o.projectName}</p>
                    <p className="text-xs text-[#5B6A78] mt-0.5 truncate max-w-[200px]">{o.provider}</p>
                  </td>
                  <td className="py-3 px-4">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[o.projectType] ?? "bg-gray-100 text-[#41505F]"}`}>
                      {PROJECT_TYPES.find((t) => t.value === o.projectType)?.label ?? o.projectType}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-[#41505F]">{o.standard.replace("_", " ")}</td>
                  <td className="py-3 px-4 text-[#41505F] tabular-nums">{o.vintage}</td>
                  <td className="py-3 px-4 text-[#131d29] font-medium tabular-nums">{o.quantityTonnes.toFixed(2)}</td>
                  <td className="py-3 px-4 text-[#5B6A78] tabular-nums">
                    {new Date(o.purchasedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                  </td>
                  <td className="py-3 px-4">
                    {o.retirementVerified ? (
                      <span title={`Verified ${o.retirementVerifiedAt ? new Date(o.retirementVerifiedAt).toLocaleDateString("en-GB") : ""}`}
                        className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700">
                        <ShieldCheck className="h-3 w-3" /> Verified
                      </span>
                    ) : (
                      <span className="text-xs text-[#5B6A78]">-</span>
                    )}
                  </td>
                  <td className="py-3 pl-4 pr-6">
                    <div className="flex items-center gap-2 justify-end">
                      {o.retirementRef && (
                        <span title={o.retirementRef}>
                          <ExternalLink className="h-3.5 w-3.5 text-[#5B6A78]" />
                        </span>
                      )}
                      {canEdit && (
                        <OffsetRowActions
                          orgId={orgId}
                          id={o.id}
                          retirementRef={o.retirementRef}
                          retirementVerified={o.retirementVerified}
                        />
                      )}
                    </div>
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
