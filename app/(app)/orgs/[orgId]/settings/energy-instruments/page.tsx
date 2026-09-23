export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { AuthError, requireOrgMember, ROLE_GROUPS } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { EnergyInstruments } from "./energy-instruments";

export default async function EnergyInstrumentsPage({ params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params;

  let canEdit = false;
  try {
    const { membership } = await requireOrgMember(orgId, ...ROLE_GROUPS.editor, "reviewer", "viewer", "auditor");
    canEdit = ROLE_GROUPS.editor.includes(membership.role);
  } catch (err) {
    if (err instanceof AuthError && err.status === 401) redirect("/sign-in");
    return <p className="p-8 text-red-600">You do not have access to electricity contracts.</p>;
  }

  const [instruments, facilities] = await Promise.all([
    prisma.energyInstrument.findMany({
      where: { organizationId: orgId },
      include: { facility: { select: { name: true } } },
      orderBy: [{ validFrom: "desc" }, { createdAt: "desc" }],
    }),
    prisma.facility.findMany({ where: { organizationId: orgId }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);

  return (
    <EnergyInstruments
      orgId={orgId}
      canEdit={canEdit}
      facilities={facilities}
      instruments={instruments.map((i) => ({
        id: i.id,
        type: i.type,
        facilityName: i.facility?.name ?? null,
        supplierName: i.supplierName,
        reference: i.reference,
        coveredKwh: i.coveredKwh == null ? null : Number(i.coveredKwh),
        emissionFactorKgPerKwh: Number(i.emissionFactorKgPerKwh),
        validFrom: i.validFrom.toISOString().slice(0, 10),
        validTo: i.validTo.toISOString().slice(0, 10),
      }))}
    />
  );
}
