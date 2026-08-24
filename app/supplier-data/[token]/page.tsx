import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { SupplierDataForm } from "./supplier-data-form";

interface PageProps {
  params: Promise<{ token: string }>;
}

export default async function SupplierDataPage({ params }: PageProps) {
  const { token } = await params;

  const request = await prisma.supplierDataRequest.findUnique({
    where: { token },
    select: {
      id: true,
      status: true,
      expiresAt: true,
      categoryCode: true,
      notes: true,
      organization: { select: { name: true } },
      reportingPeriod: { select: { label: true, startDate: true, endDate: true } },
    },
  });

  if (!request) notFound();

  const now = new Date();
  const expired = request.expiresAt <= now;
  const submitted = request.status === "submitted";

  const categoryName = request.categoryCode
    .replace(/^s\d-/, "")
    .replace(/-/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10">
      <div className="mx-auto flex max-w-lg flex-col gap-6">
        {/* Header */}
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-sky-700">
            {request.organization.name}
          </p>
          <h1 className="mt-2 text-2xl font-bold text-slate-950">
            Emissions data request
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            {request.organization.name} is asking you to provide activity data
            for their GHG inventory. This takes about 5 minutes.
          </p>
        </div>

        <SupplierDataForm
          token={token}
          orgName={request.organization.name}
          categoryCode={request.categoryCode}
          categoryName={categoryName}
          periodLabel={request.reportingPeriod.label}
          periodStart={request.reportingPeriod.startDate.toISOString()}
          periodEnd={request.reportingPeriod.endDate.toISOString()}
          notes={request.notes ?? null}
          expiresAt={request.expiresAt.toISOString()}
          expired={expired}
          submitted={submitted}
        />
      </div>
    </main>
  );
}
