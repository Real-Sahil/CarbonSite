export const dynamic = "force-dynamic";

import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AuthError, requireOrgMember, ROLE_GROUPS } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { formatEwc, normaliseEwc } from "@/lib/waste/duty-of-care";
import { MATERIAL_KIND_LABELS, MATERIAL_KINDS } from "@/lib/material/schemas";
import { loadMaterial, MATERIAL_EDITORS } from "@/lib/material/server";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ClassificationActions, ClassificationForm, EditClassification, EditMovement, MovementActions, MovementForm } from "./material-actions";

interface Props {
  params: Promise<{ orgId: string }>;
  searchParams: Promise<{ siteId?: string; status?: string }>;
}

const STATUSES = ["planned", "dispatched", "received", "rejected", "cancelled"] as const;
const STATUS_STYLE: Record<string, string> = {
  planned: "bg-slate-100 text-slate-700", dispatched: "bg-blue-100 text-blue-800", received: "bg-green-100 text-green-800",
  rejected: "bg-red-100 text-red-800", cancelled: "bg-slate-100 text-slate-500",
};
const day = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : "–");
const n = (v: number | null | undefined, dp = 1) => (v == null ? "–" : v.toLocaleString("en-GB", { maximumFractionDigits: dp }));
const ewc = (code: string | null) => { const c = normaliseEwc(code); return c ? formatEwc(c) : code ?? "–"; };

export default async function MaterialMovementsPage({ params, searchParams }: Props) {
  const { orgId } = await params;
  const sp = await searchParams;

  let role;
  try {
    role = (await requireOrgMember(orgId, ...ROLE_GROUPS.anyMember)).membership.role;
  } catch (err) {
    if (err instanceof AuthError && err.status === 401) redirect("/sign-in");
    if (err instanceof AuthError) notFound();
    throw err;
  }
  const canEdit = MATERIAL_EDITORS.includes(role);
  const status = STATUSES.find((s) => s === sp.status) ?? null;
  const facilities = await prisma.facility.findMany({ where: { organizationId: orgId }, select: { id: true, name: true }, orderBy: { name: "asc" } });
  const siteOk = sp.siteId ? await prisma.site.findFirst({ where: { id: sp.siteId, organizationId: orgId }, select: { id: true } }) : null;
  const siteId = siteOk?.id ?? null;
  const { sites, classifications, movements } = await loadMaterial(orgId, { siteId, status });

  const open = movements.filter((m) => m.status === "planned" || m.status === "dispatched");
  const received = movements.filter((m) => m.status === "received");
  const receivedT = received.reduce((t, m) => t + Number(m.ticketTonnes ?? 0), 0);
  const hazT = received.filter((m) => m.hazardous).reduce((t, m) => t + Number(m.ticketTonnes ?? 0), 0);
  const withErrors = movements.filter((m) => m.check.issues.some((i) => i.level === "error"));
  const qs = (extra: Record<string, string | null>) => {
    const p = new URLSearchParams();
    const merged = { siteId, status, ...extra };
    for (const [k, v] of Object.entries(merged)) if (v) p.set(k, v);
    const s = p.toString();
    return s ? `?${s}` : "?";
  };

  return (
    <div className="mx-auto flex max-w-[1200px] flex-col gap-8 px-4 py-8 sm:px-[42px]">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-[#111827]">Material movements</h1>
        <p className="mt-2 max-w-[70ch] text-sm text-[#374151]">
          Contaminated soil, asbestos, invasive species and other hazardous material: classify it before it moves, plan each load, and
          keep the duty of care evidence together. A received load becomes a waste record, so your waste totals, ESRS E5 figures and
          carbon come from the one register.
        </p>
        <p className="mt-2 max-w-[70ch] text-xs text-[#6B7280]">
          Written for England and Wales: carrier registrations and notes follow the Environment Agency and Natural Resources Wales
          systems. Scotland and Northern Ireland differ. This page shows whether the evidence is complete. It does not decide whether a
          load is lawful: your competent person does, and should confirm the rules for your sites.
        </p>
      </div>

      <nav className="flex flex-wrap gap-2 text-sm" aria-label="Filters">
        {sites.length > 1 && (<>
          <Link href={qs({ siteId: null })} aria-current={!siteId ? "page" : undefined} className={`rounded-full border px-3 py-1 ${!siteId ? "border-[#111827] bg-[#111827] text-white" : "border-[#E5E7EB] text-[#374151]"}`}>All sites</Link>
          {sites.map((s) => <Link key={s.id} href={qs({ siteId: s.id })} aria-current={siteId === s.id ? "page" : undefined} className={`rounded-full border px-3 py-1 ${siteId === s.id ? "border-[#111827] bg-[#111827] text-white" : "border-[#E5E7EB] text-[#374151]"}`}>{s.name}</Link>)}
          <span className="mx-1 self-center text-[#D1D5DB]">|</span>
        </>)}
        <Link href={qs({ status: null })} aria-current={!status ? "page" : undefined} className={`rounded-full border px-3 py-1 ${!status ? "border-[#111827] bg-[#111827] text-white" : "border-[#E5E7EB] text-[#374151]"}`}>Any status</Link>
        {STATUSES.map((s) => <Link key={s} href={qs({ status: s })} aria-current={status === s ? "page" : undefined} className={`rounded-full border px-3 py-1 capitalize ${status === s ? "border-[#111827] bg-[#111827] text-white" : "border-[#E5E7EB] text-[#374151]"}`}>{s}</Link>)}
      </nav>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="On the way or planned" value={`${open.length}`} note={`${n(open.reduce((t, m) => t + Number(m.plannedTonnes), 0))} t planned`} />
        <Kpi label="Received" value={`${n(receivedT)} t`} note={`${received.length} loads`} />
        <Kpi label="Of which hazardous" value={`${n(hazT)} t`} note={receivedT > 0 ? `${((hazT / receivedT) * 100).toFixed(0)}% of received` : "No loads received"} />
        <Kpi label="Loads with evidence gaps" value={`${withErrors.length}`} note={withErrors.length ? "Open the checks below" : "None"} tone={withErrors.length ? "warn" : "good"} />
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Loads</CardTitle><CardDescription>Newest first. Each load is checked against the duty of care rules as you fill it in.</CardDescription></CardHeader>
        <CardContent className="overflow-x-auto">
          {movements.length === 0 ? <p className="text-sm text-[#374151]">No loads yet. Classify a material, then plan a load below.</p> : (
            <table className="w-full min-w-[900px] text-sm tabular-nums">
              <thead>
                <tr className="border-b border-[#E5E7EB] text-left text-xs text-[#374151]">
                  <th className="py-2 pr-3 font-normal">Date</th><th className="py-2 pr-3 font-normal">Material</th><th className="py-2 pr-3 font-normal">To</th>
                  <th className="py-2 pr-3 font-normal">Carrier</th><th className="py-2 pr-3 text-right font-normal">Tonnes</th><th className="py-2 pr-3 font-normal">Status</th>
                  <th className="py-2 pr-3 font-normal">Evidence</th>{canEdit && <th className="py-2 text-right font-normal"><span className="sr-only">Actions</span></th>}
                </tr>
              </thead>
              <tbody>
                {movements.map((m) => {
                  const errs = m.check.issues.filter((i) => i.level === "error");
                  const warns = m.check.issues.filter((i) => i.level === "warning");
                  return (
                    <tr key={m.id} className="border-b border-[#F3F4F6] align-top">
                      <td className="py-2.5 pr-3 text-[#374151]">{day(m.receivedOn ?? m.plannedOn)}</td>
                      <td className="py-2.5 pr-3"><p className="font-medium text-[#111827]">{m.classificationName}</p><p className="text-xs text-[#6B7280]">{ewc(m.ewcCode)}{m.hazardous ? " · hazardous" : ""}{m.siteName ? ` · ${m.siteName}` : ""}</p></td>
                      <td className="py-2.5 pr-3 text-[#374151]">{m.destinationName}{m.destinationPermit && <span className="block text-xs text-[#6B7280]">{m.destinationPermit}</span>}</td>
                      <td className="py-2.5 pr-3 text-[#374151]">{m.carrierName ?? "–"}{m.vehicleRegistration && <span className="block text-xs text-[#6B7280]">{m.vehicleRegistration}</span>}{m.noteReference && <span className="block text-xs text-[#6B7280]">Note {m.noteReference}</span>}</td>
                      <td className="py-2.5 pr-3 text-right">{n(Number(m.ticketTonnes ?? m.plannedTonnes), 2)}{m.ticketTonnes == null && <span className="block text-xs text-[#6B7280]">planned</span>}</td>
                      <td className="py-2.5 pr-3"><span className={`rounded-full px-2 py-0.5 text-xs capitalize ${STATUS_STYLE[m.status] ?? ""}`}>{m.status}</span>{m.rejectionReason && <span className="block text-xs text-[#6B7280]">{m.rejectionReason}</span>}</td>
                      <td className="py-2.5 pr-3">
                        {m.check.issues.length === 0 ? <span className="text-xs text-green-700">Complete</span> : (
                          <details>
                            <summary className="cursor-pointer text-xs">
                              {errs.length > 0 && <span className="font-medium text-red-600">{errs.length} to fix</span>}{errs.length > 0 && warns.length > 0 && " · "}{warns.length > 0 && <span className="text-amber-700">{warns.length} to check</span>}
                            </summary>
                            <ul className="mt-1 max-w-[320px] space-y-1 text-xs">
                              {m.check.issues.map((i) => <li key={i.code} className={i.level === "error" ? "text-red-700" : "text-amber-800"}>{i.message}{i.fix && <span className="text-[#6B7280]"> Fix: {i.fix.label}.</span>}</li>)}
                            </ul>
                          </details>
                        )}
                        <span className="mt-1 block text-xs text-[#6B7280]">Keep until {day(m.check.keepUntil)}</span>
                      </td>
                      {canEdit && (
                        <td className="py-2.5 text-right">
                          <MovementActions orgId={orgId} id={m.id} status={m.status} facilities={facilities} plannedTonnes={Number(m.plannedTonnes)} defaultFacilityId={m.facilityId} />
                          {m.status !== "cancelled" && m.status !== "rejected" && (
                            <div className="mt-2">
                              <EditMovement orgId={orgId} sites={sites} facilities={facilities} classifications={classifications} initial={JSON.parse(JSON.stringify(m))} />
                            </div>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Classifications</CardTitle><CardDescription>A load can only be dispatched once its material is classified and approved. Changing an approved classification returns it to draft.</CardDescription></CardHeader>
        <CardContent className="overflow-x-auto">
          {classifications.length === 0 ? <p className="text-sm text-[#374151]">Nothing classified yet.</p> : (
            <table className="w-full min-w-[760px] text-sm">
              <thead>
                <tr className="border-b border-[#E5E7EB] text-left text-xs text-[#374151]">
                  <th className="py-2 pr-3 font-normal">Material</th><th className="py-2 pr-3 font-normal">EWC</th><th className="py-2 pr-3 font-normal">Classified by</th><th className="py-2 pr-3 font-normal">Status</th>{canEdit && <th className="py-2 text-right font-normal"><span className="sr-only">Actions</span></th>}
                </tr>
              </thead>
              <tbody>
                {classifications.map((c) => (
                  <tr key={c.id} className={`border-b border-[#F3F4F6] align-top ${c.status === "withdrawn" ? "opacity-60" : ""}`}>
                    <td className="py-2.5 pr-3"><p className="font-medium text-[#111827]">{c.name}</p><p className="text-xs text-[#6B7280]">{(MATERIAL_KINDS as readonly string[]).includes(c.materialKind) ? MATERIAL_KIND_LABELS[c.materialKind as (typeof MATERIAL_KINDS)[number]] : c.materialKind}{c.siteName ? ` · ${c.siteName}` : ""}{c.labReference ? ` · lab ${c.labReference}` : ""}</p></td>
                    <td className="py-2.5 pr-3 tabular-nums">{ewc(c.ewcCode)}{c.hazardous && <span className="block text-xs text-red-700">Hazardous{c.hazardousProperties.length ? `: ${c.hazardousProperties.join(", ")}` : ""}</span>}</td>
                    <td className="py-2.5 pr-3 text-[#374151]">{c.classifiedBy ?? "–"}{c.classifiedOn && <span className="block text-xs text-[#6B7280]">{day(c.classifiedOn)}</span>}</td>
                    <td className="py-2.5 pr-3"><span className="capitalize">{c.status}</span>{c.status === "draft" && c.blockers.length > 0 && <span className="block max-w-[280px] text-xs text-amber-800">{c.blockers.join(" ")}</span>}</td>
                    {canEdit && (
                      <td className="py-2.5 text-right">
                        <ClassificationActions orgId={orgId} id={c.id} status={c.status} canApprove={c.blockers.length === 0} />
                        {c.status !== "withdrawn" && <div className="mt-2"><EditClassification orgId={orgId} sites={sites} initial={JSON.parse(JSON.stringify(c))} /></div>}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      {canEdit && (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card><CardHeader><CardTitle className="text-base">Classify a material</CardTitle></CardHeader><CardContent><ClassificationForm orgId={orgId} sites={sites} /></CardContent></Card>
          <Card>
            <CardHeader><CardTitle className="text-base">Plan a load</CardTitle></CardHeader>
            <CardContent>{sites.length === 0 || classifications.filter((c) => c.status !== "withdrawn").length === 0 ? <p className="text-sm text-[#374151]">Add a site and classify a material first.</p> : <MovementForm orgId={orgId} sites={sites} facilities={facilities} classifications={classifications} />}</CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

function Kpi({ label, value, note, tone }: { label: string; value: string; note?: string; tone?: "good" | "warn" }) {
  return (
    <div className="rounded-[10px] border border-[#E5E7EB] bg-white p-4">
      <p className="text-xs text-[#374151]">{label}</p>
      <p className="mt-1 text-lg font-semibold tabular-nums text-[#111827]">{value}</p>
      {note && <p className={`mt-1 text-xs ${tone === "good" ? "text-green-700" : tone === "warn" ? "text-amber-700" : "text-[#6B7280]"}`}>{note}</p>}
    </div>
  );
}
