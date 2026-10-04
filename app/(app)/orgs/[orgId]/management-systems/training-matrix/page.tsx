export const dynamic = "force-dynamic";

import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { AuthError, requireOrgMember } from "@/lib/auth/session";
import { MS_READERS } from "@/lib/management-systems/access";
import { EXPIRING_DAYS, trainingMatrix, type CellState } from "@/lib/management-systems/training";
import { EmptyState } from "@/components/ui/empty-state";

const CELL: Record<CellState, string> = {
  valid: "bg-emerald-50 text-emerald-800",
  no_expiry: "bg-emerald-50 text-emerald-800",
  expiring: "bg-amber-50 text-amber-800",
  expired: "bg-red-50 text-red-700",
};

export default async function TrainingMatrixPage({ params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params;
  try {
    await requireOrgMember(orgId, ...MS_READERS);
  } catch (err) {
    if (err instanceof AuthError && err.status === 401) redirect("/sign-in");
    return <div className="p-8 text-sm text-[#6B7280]">You do not have permission to view management systems.</div>;
  }
  const [competences, records] = await Promise.all([
    prisma.msCompetence.findMany({ where: { organizationId: orgId }, select: { id: true, title: true, validityMonths: true, appliesTo: true }, orderBy: { title: "asc" } }),
    prisma.msTrainingRecord.findMany({
      where: { organizationId: orgId },
      select: { id: true, competenceId: true, personUserId: true, personName: true, employer: true, completedOn: true, expiresOn: true },
    }),
  ]);
  const { rows, totals } = trainingMatrix(competences, records, new Date(new Date().toISOString().slice(0, 10) + "T00:00:00Z"));
  const reg = (k: string) => `/orgs/${orgId}/management-systems/registers/${k}`;

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6 p-6">
      <div className="flex flex-col gap-1">
        <Link href={`/orgs/${orgId}/management-systems`} className="text-xs text-[#6B7280] hover:text-[#111827]">Management systems</Link>
        <h1 className="text-2xl font-bold tracking-tight text-[#111827]">Training matrix</h1>
        <p className="max-w-[75ch] text-sm text-[#6B7280]">
          Each person&apos;s latest record for each competence requirement (ISO clause 7.2). Amber expires within {EXPIRING_DAYS} days, red has expired; an empty cell has no record.
          Add requirements under <Link href={reg("competences")} className="underline underline-offset-2">Competence requirements</Link> and records under <Link href={reg("training-records")} className="underline underline-offset-2">Training records</Link>.
        </p>
        <p className="text-sm tabular-nums text-[#374151]">{totals.expired} expired · {totals.expiring} expiring soon · {rows.length} people</p>
      </div>
      {competences.length === 0 || rows.length === 0 ? (
        <EmptyState title="No training recorded yet" description="Record training against a competence and each person's expiry shows here." />
      ) : (
        <div className="overflow-x-auto rounded-[14px] border border-[#E5E7EB] bg-white">
          <table className="text-left text-xs">
            <thead className="border-b border-[#E5E7EB] text-[#6B7280]">
              <tr>
                <th className="sticky left-0 bg-white px-3 py-2 font-medium">Person</th>
                {competences.map((c) => (
                  <th key={c.id} className="min-w-[110px] px-3 py-2 align-bottom font-medium" title={c.appliesTo ?? undefined}>{c.title}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F3F4F6]">
              {rows.map((r) => (
                <tr key={r.key}>
                  <th scope="row" className="sticky left-0 whitespace-nowrap bg-white px-3 py-2 text-left font-medium text-[#111827]">
                    {r.name}
                    {r.employer && <span className="block font-normal text-[#6B7280]">{r.employer}</span>}
                  </th>
                  {competences.map((c) => {
                    const cell = r.cells[c.id];
                    return (
                      <td key={c.id} className="px-2 py-1.5">
                        {cell ? (
                          <Link href={`${reg("training-records")}#row-${cell.recordId}`} className={`block rounded px-2 py-1 tabular-nums ${CELL[cell.state]}`}>
                            {cell.expiresOn ? `${cell.state === "expired" ? "Expired" : "To"} ${cell.expiresOn}` : "Held"}
                          </Link>
                        ) : (
                          <span className="block px-2 py-1 text-[#D1D5DB]">-</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
