export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { AuthError, requireOrgMember } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { DataRetentionForm } from "./data-retention-form";

interface Props {
  params: Promise<{ orgId: string }>;
}

export default async function DataRetentionPage({ params }: Props) {
  const { orgId } = await params;

  try {
    await requireOrgMember(orgId, "admin");
  } catch (err) {
    if (err instanceof AuthError && err.status === 401) redirect("/sign-in");
    return (
      <div className="p-8">
        <p className="text-red-600 text-sm">
          Only organisation admins can manage data retention settings.
        </p>
      </div>
    );
  }

  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { evidenceRetentionDays: true },
  });

  return (
    <div className="max-w-[640px] py-10 px-8">
      <h1 className="text-xl font-bold text-[#111827] tracking-tight mb-1">Data retention</h1>
      <p className="text-sm text-[#374151] mb-8 max-w-[55ch]">
        Control how long field submission evidence files are retained. UK GDPR
        recommends keeping GHG audit evidence for at least 7 years. Setting a
        retention period will schedule automatic deletion of files older than the
        specified age.
      </p>

      <DataRetentionForm orgId={orgId} current={org?.evidenceRetentionDays ?? null} />

      <div className="mt-8 rounded-[14px] border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
        <p className="font-medium mb-1">Before setting a retention period</p>
        <ul className="list-disc list-inside space-y-1 text-xs text-amber-800">
          <li>UK Companies Act 2006 requires financial records for 6 years.</li>
          <li>
            HMRC recommends retaining records supporting a tax return for 6 years from
            the end of the relevant accounting period.
          </li>
          <li>
            GHG Protocol and ISO 14064-3 require evidence to be available for
            third-party assurance during the audit period.
          </li>
          <li>
            Files linked to an open assurance engagement will not be deleted
            regardless of the retention period set here.
          </li>
        </ul>
      </div>
    </div>
  );
}
