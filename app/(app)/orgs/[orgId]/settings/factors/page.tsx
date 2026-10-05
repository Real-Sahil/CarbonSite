export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { AuthError, requireOrgMember, ROLE_GROUPS } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { getOrgCustomFactorLibrary } from "@/lib/calculation/custom-factors";
import { FactorsPanel } from "./factors-panel";

export default async function OrgFactorsPage({ params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params;
  try {
    await requireOrgMember(orgId, ...ROLE_GROUPS.editor);
  } catch (err) {
    if (err instanceof AuthError && err.status === 401) redirect("/sign-in");
    return <div className="p-8 text-sm text-[#6B7280]">You do not have permission to manage emission factors.</div>;
  }

  const [factors, categories, org] = await Promise.all([
    getOrgCustomFactorLibrary(orgId),
    prisma.emissionCategory.findMany({ select: { id: true, code: true, name: true, scope: true }, orderBy: [{ scope: "asc" }, { name: "asc" }] }),
    prisma.organization.findUnique({ where: { id: orgId }, select: { hqCountry: true } }),
  ]);

  return (
    <div className="mx-auto max-w-[1000px] px-4 py-8 sm:px-8">
      <h2 className="text-lg font-semibold text-[#111827]">Your emission factors</h2>
      <p className="mt-1 max-w-[65ch] text-sm text-[#6B7280]">
        A factor you add here is tried before the run&apos;s library, for records in the same category whose unit it can use. Use it when a supplier gives you a
        figure (a fuel certificate, an EPD, a supplier&apos;s own rate) or when the library has none. Always name the source: it is printed in the audit trail.
      </p>
      <FactorsPanel
        orgId={orgId}
        homeCountry={org?.hqCountry ?? ""}
        categories={categories}
        factors={factors.map((f) => ({
          id: f.id,
          category: f.emissionCategory?.name ?? `Scope ${f.scope}`,
          activityType: f.activityType,
          unit: f.inputUnit,
          co2e: f.co2e == null ? null : Number(f.co2e),
          country: f.geographyCountry,
          source: f.source,
          version: f.version,
          from: f.effectiveStartDate?.toISOString().slice(0, 10) ?? null,
          to: f.effectiveEndDate?.toISOString().slice(0, 10) ?? null,
        }))}
      />
    </div>
  );
}
