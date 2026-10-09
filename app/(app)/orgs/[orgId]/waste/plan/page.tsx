export const dynamic = "force-dynamic";

import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireOrgMember, ROLE_GROUPS, AuthError } from "@/lib/auth/session";
import { LINK_ISSUERS } from "@/lib/evidence/submission-link";
import { getSelectedProject } from "@/lib/project/selected";
import { loadWastePlan } from "@/lib/waste/swmp-load";
import { ROUTE_LABEL } from "@/lib/waste/swmp";
import { PlanEditor } from "./plan-editor";

const n = (v: number, d = 1) => v.toLocaleString("en-GB", { minimumFractionDigits: d, maximumFractionDigits: d });

export default async function WastePlanPage({ params, searchParams }: { params: Promise<{ orgId: string }>; searchParams: Promise<{ projectId?: string }> }) {
  const { orgId } = await params;
  const sp = await searchParams;
  let role = "viewer";
  try {
    role = (await requireOrgMember(orgId, ...ROLE_GROUPS.dataReaders)).membership.role;
  } catch (err) {
    if (err instanceof AuthError) redirect("/sign-in");
    throw err;
  }
  const projects = await prisma.project.findMany({ where: { organizationId: orgId }, select: { id: true, name: true }, orderBy: { name: "asc" }, take: 500 });
  const selected = await getSelectedProject(orgId);
  const project = projects.find((p) => p.id === (sp.projectId ?? selected?.id));

  const header = (
    <div className="mb-6">
      <h1 className="text-2xl font-semibold tracking-tight text-gray-900">Site Waste Management Plan</h1>
      <p className="mt-1 text-sm text-gray-500">One plan per project: who is responsible, the waste you expect and where it should go, your diversion target, and how you will reduce waste. The page sets the plan beside the waste you have actually recorded.</p>
      <Link href={`/orgs/${orgId}/waste`} className="mt-2 inline-block text-sm font-medium text-teal-700 hover:text-teal-800 print:hidden">Back to waste</Link>
    </div>
  );

  if (!project) {
    return (
      <div className="mx-auto max-w-3xl p-8">
        {header}
        {projects.length === 0 ? (
          <p className="rounded-xl border border-gray-200 bg-white p-8 text-center text-sm text-gray-500">Add a project first (Contracts), then write its plan here.</p>
        ) : (
          <ul className="divide-y rounded-xl border border-gray-200 bg-white">
            {projects.map((p) => (
              <li key={p.id}><Link className="block px-4 py-3 text-sm font-medium text-gray-900 hover:bg-gray-50" href={`/orgs/${orgId}/waste/plan?projectId=${p.id}`}>{p.name}</Link></li>
            ))}
          </ul>
        )}
      </div>
    );
  }

  const data = await loadWastePlan(orgId, project.id);
  const c = data.comparison;
  const done = data.checks.filter((k) => k.ok).length;
  return (
    <div className="mx-auto max-w-5xl space-y-6 p-8">
      {header}
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <span className="rounded-full bg-gray-100 px-3 py-1 font-medium">{project.name}</span>
        <span className={`rounded-full px-3 py-1 text-xs font-medium ${data.status === "approved" ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-800"}`}>
          {data.exists ? `${data.status === "approved" ? "Approved" : "Draft"} · version ${data.version}` : "No plan yet"}
        </span>
        {data.approvedAt && <span className="text-xs text-gray-500">Approved {data.approvedAt.toISOString().slice(0, 10)}</span>}
        {projects.length > 1 && (
          <form className="ml-auto print:hidden" action={`/orgs/${orgId}/waste/plan`}>
            <label htmlFor="swmp-project" className="sr-only">Project</label>
            <select id="swmp-project" name="projectId" defaultValue={project.id} className="h-9 rounded-md border border-gray-300 bg-white px-2 text-sm">{projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
            <button className="ml-2 text-sm underline underline-offset-2">Open</button>
          </form>
        )}
      </div>

      <section aria-labelledby="swmp-checks" className="rounded-xl border border-gray-200 bg-white p-5 print:hidden">
        <h2 id="swmp-checks" className="text-sm font-semibold text-gray-900">What the plan has ({done} of {data.checks.length})</h2>
        <ul className="mt-2 space-y-1 text-sm">
          {data.checks.map((k) => <li key={k.key} className={k.ok ? "text-gray-700" : "text-amber-800"}>{k.ok ? "✓" : "○"} {k.label}</li>)}
        </ul>
        <p className="mt-2 text-xs text-gray-500">This is a checklist of what a reader looks for. It does not say the plan meets any client requirement or law.</p>
      </section>

      <PlanEditor orgId={orgId} projectId={project.id} plan={data.plan} status={data.status} canEdit={LINK_ISSUERS.includes(role as never)} canApprove={ROLE_GROUPS.editor.includes(role as never)} />

      <section aria-labelledby="swmp-actual" className="rounded-xl border border-gray-200 bg-white p-5">
        <h2 id="swmp-actual" className="text-sm font-semibold text-gray-900">Forecast against what was recorded</h2>
        {data.recordCount === 0 ? (
          <p className="mt-2 text-sm text-gray-500">No waste has been recorded against this project yet. Tie waste records to the project (Waste → Add) and they appear here.</p>
        ) : (
          <>
            <div className="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
              <div><div className="text-xs text-gray-500">Forecast</div><div className="text-lg font-semibold tabular-nums">{n(c.forecastTotal)} t</div></div>
              <div><div className="text-xs text-gray-500">Recorded</div><div className="text-lg font-semibold tabular-nums">{n(c.actualTotal)} t</div></div>
              <div><div className="text-xs text-gray-500">Diverted so far</div><div className="text-lg font-semibold tabular-nums">{c.actualDiversionPct == null ? "-" : `${n(c.actualDiversionPct, 0)}%`}</div></div>
              <div><div className="text-xs text-gray-500">Target</div><div className="text-lg font-semibold tabular-nums">{data.plan.targetDiversionPct == null ? "-" : `${n(data.plan.targetDiversionPct, 0)}%`}</div></div>
            </div>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[520px] text-sm">
                <caption className="sr-only">Forecast and recorded waste by type</caption>
                <thead><tr className="text-left text-xs text-gray-500"><th className="py-1 pr-3">Waste type</th><th className="py-1 pr-3 text-right">Forecast (t)</th><th className="py-1 pr-3 text-right">Recorded (t)</th><th className="py-1 pr-3 text-right">Difference (t)</th><th className="py-1">Planned route</th></tr></thead>
                <tbody className="divide-y divide-gray-50">
                  {c.rows.map((r, i) => (
                    <tr key={i}><td className="py-2 pr-3">{r.wasteType}</td><td className="py-2 pr-3 text-right tabular-nums">{n(r.forecastTonnes)}</td><td className="py-2 pr-3 text-right tabular-nums">{n(r.actualTonnes)}</td><td className={`py-2 pr-3 text-right tabular-nums ${r.varianceTonnes > 0 ? "text-amber-800" : ""}`}>{r.varianceTonnes > 0 ? "+" : ""}{n(r.varianceTonnes)}</td><td className="py-2">{ROUTE_LABEL[r.plannedRoute]}</td></tr>
                  ))}
                  {c.unplannedTonnes > 0 && <tr><td className="py-2 pr-3 italic">Not in the forecast</td><td className="py-2 pr-3 text-right">-</td><td className="py-2 pr-3 text-right tabular-nums">{n(c.unplannedTonnes)}</td><td className="py-2 pr-3 text-right tabular-nums text-amber-800">+{n(c.unplannedTonnes)}</td><td /></tr>}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
