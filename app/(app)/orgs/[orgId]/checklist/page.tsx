export const dynamic = "force-dynamic";

import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthError, requireOrgMember, ROLE_GROUPS } from "@/lib/auth/session";
import { defaultMonth, loadChecklist, MONTH_RE, monthLabel, monthsBefore } from "@/lib/completeness/monthly";

export default async function ChecklistPage({
  params,
  searchParams,
}: {
  params: Promise<{ orgId: string }>;
  searchParams: Promise<{ month?: string }>;
}) {
  const { orgId } = await params;
  const { month: raw } = await searchParams;
  try {
    await requireOrgMember(orgId, ...ROLE_GROUPS.editor);
  } catch (err) {
    if (err instanceof AuthError && err.status === 401) redirect("/sign-in");
    return <div className="p-8 text-sm text-[#6B7280]">You do not have permission to view the monthly checklist.</div>;
  }

  const current = defaultMonth();
  const month = raw && MONTH_RE.test(raw) ? raw : current;
  const items = await loadChecklist(orgId, month);
  const actions = items.filter((i) => i.severity === "action");
  const info = items.filter((i) => i.severity === "info");
  const recentMonths = [...monthsBefore(current, 5), current].reverse();

  const list = (rows: typeof items) => (
    <ul className="flex flex-col gap-3">
      {rows.map((i) => (
        <li key={i.id} className="rounded-[12px] border border-[#E5E7EB] bg-white p-5">
          <h3 className="text-sm font-semibold text-[#111827]">{i.title}</h3>
          <p className="mt-1 text-sm text-[#4B5563]">{i.detail}</p>
          <p className="mt-2 text-xs text-[#6B7280]">
            <span className="font-medium">Where to do it:</span> {i.where}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {i.fixes.map((f) => (
              <Link
                key={f.path}
                href={`/orgs/${orgId}/${f.path}`}
                className="inline-flex h-8 items-center rounded-[8px] border border-[#D1D5DB] bg-white px-3 text-xs font-medium text-[#111827] hover:border-[#9CA3AF] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500"
              >
                {f.label}
              </Link>
            ))}
          </div>
        </li>
      ))}
    </ul>
  );

  return (
    <div className="min-h-[100dvh] bg-[#f9fafb]">
      <div className="border-b border-[#E5E7EB] bg-white">
        <div className="mx-auto max-w-[900px] px-4 py-8 sm:px-8">
          <h1 className="text-2xl font-bold tracking-tight text-[#111827]">Monthly checklist</h1>
          <p className="mt-1 max-w-[65ch] text-sm text-[#6B7280]">
            What to add, review or calculate so {monthLabel(month)} is complete. Each item says where to do it and links straight there.
          </p>
          <nav aria-label="Month" className="mt-4 flex flex-wrap gap-2">
            {recentMonths.map((m) => (
              <Link
                key={m}
                href={`/orgs/${orgId}/checklist?month=${m}`}
                aria-current={m === month ? "page" : undefined}
                className={`rounded-full border px-3 py-1 text-xs font-medium ${m === month ? "border-[#111827] bg-[#111827] text-white" : "border-[#D1D5DB] bg-white text-[#374151] hover:border-[#9CA3AF]"}`}
              >
                {monthLabel(m)}
              </Link>
            ))}
          </nav>
        </div>
      </div>
      <div className="mx-auto flex max-w-[900px] flex-col gap-8 px-4 py-8 sm:px-8">
        {items.length === 0 ? (
          <p role="status" className="rounded-[12px] border border-green-200 bg-green-50 px-5 py-4 text-sm text-green-800">
            Nothing is outstanding for {monthLabel(month)}. Regular sources have records, nothing is waiting on you, and the calculation is up to date.
          </p>
        ) : null}
        {actions.length > 0 ? (
          <section aria-labelledby="act-h" className="flex flex-col gap-3">
            <h2 id="act-h" className="text-base font-semibold text-[#111827]">To do ({actions.length})</h2>
            {list(actions)}
          </section>
        ) : null}
        {info.length > 0 ? (
          <section aria-labelledby="info-h" className="flex flex-col gap-3">
            <h2 id="info-h" className="text-base font-semibold text-[#111827]">Worth doing ({info.length})</h2>
            {list(info)}
          </section>
        ) : null}
      </div>
    </div>
  );
}
