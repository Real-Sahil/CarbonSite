export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { AuthError, requireOrgMember } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { OperationsSetup } from "./setup-actions";

interface OperationsSettingsPageProps {
  params: Promise<{ orgId: string }>;
}

export default async function OperationsSettingsPage({
  params,
}: OperationsSettingsPageProps) {
  const { orgId } = await params;

  let authError: "forbidden" | "db" | null = null;

  try {
    await requireOrgMember(orgId, "admin", "editor");
  } catch (err) {
    if (err instanceof AuthError) {
      if (err.status === 401) redirect("/sign-in");
      authError = "forbidden";
    } else {
      authError = "db";
    }
  }

  if (authError === "forbidden") {
    return (
      <div className="p-8">
        <p className="text-red-600">
          You do not have permission to manage operational setup.
        </p>
      </div>
    );
  }

  if (authError === "db") {
    return (
      <div className="p-8">
        <p className="text-red-600 text-sm">
          Failed to verify permissions. The database may be updating — try refreshing in a moment.
        </p>
      </div>
    );
  }

  const data = await Promise.all([
    prisma.organization.findUniqueOrThrow({
      where: { id: orgId },
      select: { name: true, industry: true, hqCountry: true, reportingCurrency: true },
    }),
    prisma.reportingPeriod.findMany({
      where: { organizationId: orgId },
      orderBy: [{ startDate: "desc" }, { createdAt: "desc" }],
    }),
    prisma.facility.findMany({
      where: { organizationId: orgId },
      orderBy: { name: "asc" },
    }),
    prisma.businessUnit.findMany({
      where: { organizationId: orgId },
      orderBy: { name: "asc" },
    }),
    prisma.factorLibrary.findMany({
      include: { _count: { select: { factors: true } } },
      orderBy: [{ name: "asc" }, { version: "desc" }],
    }),
    prisma.embodiedMaterial.findMany({
      select: { gwpC1C4: true, gwpC1: true, gwpC2: true, gwpC3: true, gwpC4: true, replacementCycleYears: true },
    }),
  ]).catch(() => null);

  if (!data) {
    return (
      <div className="p-8">
        <p className="text-red-600 text-sm">
          Failed to load settings. The database may be updating — try refreshing in a moment.
        </p>
      </div>
    );
  }

  const [org, periods, facilities, businessUnits, factorLibraries, materials] = data;

  const materialLibrary = {
    total: materials.length,
    missingEndOfLife: materials.filter(
      (m) => m.gwpC1C4 == null && m.gwpC1 == null && m.gwpC2 == null && m.gwpC3 == null && m.gwpC4 == null,
    ).length,
    missingReplacementCycle: materials.filter((m) => m.replacementCycleYears == null).length,
  };

  return (
    <div className="flex flex-col gap-[28px]">
      <OperationsSetup
        orgId={orgId}
        orgProfile={{
          name: org.name,
          industry: org.industry ?? "",
          hqCountry: org.hqCountry ?? "",
          reportingCurrency: org.reportingCurrency,
        }}
        periods={periods.map((period) => ({
          id: period.id,
          label: period.label,
          type: period.type,
          startDate: period.startDate.toISOString(),
          endDate: period.endDate.toISOString(),
          status: period.status,
        }))}
        facilities={facilities.map((facility) => ({
          id: facility.id,
          name: facility.name,
          country: facility.country ?? "",
          region: facility.region ?? "",
        }))}
        businessUnits={businessUnits.map((businessUnit) => ({
          id: businessUnit.id,
          name: businessUnit.name,
        }))}
        factorLibraries={factorLibraries.map((library) => ({
          id: library.id,
          name: library.name,
          version: library.version,
          factorCount: library._count.factors,
        }))}
        materialLibrary={materialLibrary}
        apiDataSources={[]}
      />
    </div>
  );
}
