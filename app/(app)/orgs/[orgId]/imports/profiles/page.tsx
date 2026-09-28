export const dynamic = "force-dynamic";

import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Plus } from "lucide-react";
import { AuthError, requireOrgMember, ROLE_GROUPS } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { PROFILE_TEMPLATES } from "@/lib/imports/profile-templates";

export default async function ImportProfilesPage({ params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params;
  let canEdit = false;
  try {
    const { membership } = await requireOrgMember(orgId, ...ROLE_GROUPS.dataReaders);
    canEdit = ROLE_GROUPS.editor.includes(membership.role);
  } catch (err) {
    if (err instanceof AuthError && err.status === 401) redirect("/sign-in");
    if (err instanceof AuthError) return <div className="p-8 text-sm text-[#6B7280]">You do not have permission to view import profiles.</div>;
    throw err;
  }

  const profiles = await prisma.importProfile.findMany({
    where: { organizationId: orgId },
    select: { id: true, name: true, sourceSystem: true, updatedAt: true, _count: { select: { rules: true, importBatches: true } } },
    orderBy: { name: "asc" },
  });
  const systemLabel = (s: string) => PROFILE_TEMPLATES.find((t) => t.sourceSystem === s)?.label ?? s;

  return (
    <div className="min-h-[100dvh] bg-[#f9fafb]">
      <div className="border-b border-[#E5E7EB] bg-white">
        <div className="mx-auto max-w-[1200px] px-4 py-8 sm:px-8">
          <Link href={`/orgs/${orgId}/imports`} className="inline-flex items-center gap-1 text-xs text-[#6B7280] hover:text-[#111827]">
            <ArrowLeft aria-hidden="true" className="h-3 w-3" /> Imports
          </Link>
          <div className="mt-3 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-[#111827]">ERP export profiles</h1>
              <p className="mt-1 max-w-[70ch] text-sm text-[#6B7280]">
                Save how your finance system&apos;s ledger export is laid out, and which ledger accounts and cost codes are emissions. Import the export each month with the profile; lines no rule covers are left out and listed, and nothing is recorded until you commit the import.
              </p>
            </div>
            {canEdit ? (
              <Button asChild size="sm" className="gap-1.5">
                <Link href={`/orgs/${orgId}/imports/profiles/new`}>
                  <Plus aria-hidden="true" className="h-3.5 w-3.5" /> New profile
                </Link>
              </Button>
            ) : null}
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-[1200px] px-4 py-8 sm:px-8">
        {profiles.length === 0 ? (
          <div className="rounded-xl border border-dashed border-[#D1D5DB] bg-white p-8 text-sm text-[#6B7280]">
            No profiles yet. Templates for SAP, Causeway Financials, COINS and Sage suggest the columns; you confirm them against a sample export and add rules for your chart of accounts.
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-[#E5E7EB] bg-white">
            <table className="w-full text-sm">
              <thead className="bg-[#F9FAFB] text-left text-xs text-[#6B7280]">
                <tr>
                  <th className="px-5 py-2.5 font-medium">Profile</th>
                  <th className="px-5 py-2.5 font-medium">System</th>
                  <th className="px-5 py-2.5 text-right font-medium">Rules</th>
                  <th className="px-5 py-2.5 text-right font-medium">Imports</th>
                  <th className="px-5 py-2.5 text-right font-medium">Updated</th>
                </tr>
              </thead>
              <tbody>
                {profiles.map((p) => (
                  <tr key={p.id} className="border-t border-[#F3F4F6]">
                    <td className="px-5 py-3">
                      {canEdit ? (
                        <Link href={`/orgs/${orgId}/imports/profiles/${p.id}`} className="font-medium text-[#111827] hover:text-[#c2410c]">{p.name}</Link>
                      ) : (
                        <span className="font-medium text-[#111827]">{p.name}</span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-[#374151]">{systemLabel(p.sourceSystem)}</td>
                    <td className="px-5 py-3 text-right tabular-nums">{p._count.rules}</td>
                    <td className="px-5 py-3 text-right tabular-nums">{p._count.importBatches}</td>
                    <td className="px-5 py-3 text-right text-[#6B7280]">{p.updatedAt.toLocaleDateString("en-GB")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
