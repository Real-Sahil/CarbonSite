export const dynamic = "force-dynamic";

import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthError, requireOrgMember, ROLE_GROUPS } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { LedgerReview } from "./ledger-review";

export default async function FromAccountingPage({ params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params;
  try {
    await requireOrgMember(orgId, ...ROLE_GROUPS.editor);
  } catch (err) {
    if (err instanceof AuthError && err.status === 401) redirect("/sign-in");
    return <div className="p-8 text-sm text-[#6B7280]">You do not have permission to stage accounting lines.</div>;
  }

  const periods = await prisma.reportingPeriod.findMany({
    where: { organizationId: orgId, status: { not: "locked" } },
    select: { id: true, label: true },
    orderBy: [{ startDate: "desc" }, { createdAt: "desc" }],
  });

  return (
    <div className="min-h-[100dvh] bg-[#f9fafb]">
      <div className="border-b border-[#E5E7EB] bg-white">
        <div className="mx-auto max-w-[1200px] px-4 py-8 sm:px-8">
          <Link href={`/orgs/${orgId}/imports`} className="text-xs font-medium text-[#6B7280] underline underline-offset-4">
            Back to imports
          </Link>
          <h1 className="mt-3 text-2xl font-bold tracking-tight text-[#111827]">From your accounting system</h1>
          <p className="mt-1 max-w-[65ch] text-sm text-[#6B7280]">
            Invoice lines already synced from Xero, each with a suggested category. Confirm the ones that are right; they go to Imports for a final review before they
            count. Fuel, energy and waste are left for you to add from the bill, because litres, kWh and tonnes are more accurate than pounds.
          </p>
        </div>
      </div>
      <div className="mx-auto max-w-[1200px] px-4 py-8 sm:px-8">
        <LedgerReview orgId={orgId} periods={periods} />
      </div>
    </div>
  );
}
