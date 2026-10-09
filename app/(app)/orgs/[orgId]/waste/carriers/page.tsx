export const dynamic = "force-dynamic";

import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthError, requireOrgMember, ROLE_GROUPS } from "@/lib/auth/session";
import { loadCarrierScorecard } from "@/lib/waste/scorecard-load";
import { MIN_MEASURED } from "@/lib/waste/scorecard";

const CELL = "px-4 py-3 text-sm text-gray-600";

export default async function CarrierScorecardPage({ params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params;
  try {
    await requireOrgMember(orgId, ...ROLE_GROUPS.dataReaders);
  } catch (err) {
    if (err instanceof AuthError) redirect("/sign-in");
    throw err;
  }
  const rows = await loadCarrierScorecard(orgId);

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-gray-900">Carrier scorecard</h1>
        <p className="mt-1 text-sm text-gray-500">
          What each carrier&apos;s loads and transfer notes show. Flags say what to look at; nothing here is a verdict on a carrier.
          Edit counts start once a carrier has {MIN_MEASURED} approved notes.
        </p>
        <Link href={`/orgs/${orgId}/waste/documents`} className="mt-2 inline-block text-sm font-medium text-teal-700 hover:text-teal-800">Back to waste documents</Link>
      </header>

      {rows.length === 0 ? (
        <p className="rounded-xl border border-gray-200 bg-white p-10 text-center text-sm text-gray-500">No loads or transfer notes yet.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
          <table className="w-full text-sm">
            <thead className="border-b border-gray-100">
              <tr>
                {["Carrier", "Loads", "Tonnes", "Median load", "Notes in / recorded", "Edits per note", "Flags"].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {rows.map((r) => (
                <tr key={r.key}>
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900">{r.name}</div>
                    {r.registration && <div className="text-xs text-gray-500">{r.registration}</div>}
                  </td>
                  <td className={CELL}>{r.loads}</td>
                  <td className={CELL}>{r.totalTonnes}</td>
                  <td className={CELL}>{r.medianTonnes ?? "-"}</td>
                  <td className={CELL}>{r.notesReceived} / {r.notesRecorded}</td>
                  <td className={CELL}>{r.avgChangedFields === null ? `Not yet (${r.measuredNotes}/${MIN_MEASURED})` : r.avgChangedFields}</td>
                  <td className="px-4 py-3">
                    {r.flags.length === 0 ? (
                      <span className="text-xs text-green-700">Nothing to check</span>
                    ) : (
                      <ul className="space-y-1">
                        {r.flags.map((f) => (
                          <li key={f.text} className={`text-xs ${f.level === "red" ? "text-red-700" : "text-amber-800"}`}>{f.text}</li>
                        ))}
                      </ul>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
