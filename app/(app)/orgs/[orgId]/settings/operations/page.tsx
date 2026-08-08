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

  try {
    await requireOrgMember(orgId, "admin", "editor");
  } catch (err) {
    if (err instanceof AuthError) {
      if (err.status === 401) redirect("/sign-in");
      return (
        <div className="p-8">
          <p className="text-red-600">
            You do not have permission to manage operational setup.
          </p>
        </div>
      );
    }
    throw err;
  }

  const [org, periods, facilities, businessUnits, factorLibraries] = await Promise.all([
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
  ]);

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
      />
    </div>
  );
}
