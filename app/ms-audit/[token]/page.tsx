import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { writeAuditLog } from "@/lib/db/audit";
import { getFramework, headingCodes } from "@/lib/management-systems/catalogue";
import { readiness, type RequirementState } from "@/lib/management-systems/readiness";
import { resolveAuditorToken, touchAuditorAccess } from "@/lib/management-systems/auditor-access";
import { rowInScope } from "@/lib/management-systems/certification-pack";
import { REGISTERS, type RegisterKey } from "@/lib/management-systems/registers/config";
import { delegate } from "@/lib/management-systems/registers/server";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Management system audit", robots: { index: false, follow: false } };

const STATE: Record<RequirementState, string> = { not_started: "Not started", in_progress: "In progress", implemented: "Implemented", not_applicable: "Not applicable" };
const SHOWN: RegisterKey[] = ["policies", "documents", "objectives", "risks", "audits", "audit-findings", "corrective-actions", "management-reviews", "complaints", "nonconformities"];
const iso = (v: unknown) => (v instanceof Date ? v.toISOString().slice(0, 10) : v == null ? "" : String(v));

/** Read-only view for a certification body's auditor, opened from a time-limited link. */
export default async function AuditorPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const access = await resolveAuditorToken(token);
  if (!access) {
    return (
      <main className="min-h-[100dvh] bg-slate-50 px-4 py-16">
        <p className="mx-auto max-w-lg rounded-lg border border-slate-200 bg-white p-5 text-sm text-slate-700">
          This link has expired or been withdrawn. Ask the organisation for a new one.
        </p>
      </main>
    );
  }
  const orgId = access.organizationId;
  // One audit entry per hour of use is enough to show who looked and when.
  if (!access.lastUsedAt || Date.now() - access.lastUsedAt.getTime() > 3_600_000) {
    await writeAuditLog({ organizationId: orgId, action: "management_system.auditor_link_opened", resourceType: "MsAuditorAccess", resourceId: access.id, metadata: { auditor: access.name, company: access.company } });
  }
  await touchAuditorAccess(access.id);

  const [org, adoptions, statuses, links] = await Promise.all([
    prisma.organization.findUnique({ where: { id: orgId }, select: { name: true } }),
    prisma.msFrameworkAdoption.findMany({ where: { organizationId: orgId, frameworkSlug: { in: access.frameworks } } }),
    prisma.msRequirementStatus.findMany({ where: { organizationId: orgId, frameworkSlug: { in: access.frameworks } } }),
    prisma.msEvidenceLink.findMany({ where: { organizationId: orgId, frameworkSlug: { in: access.frameworks } }, orderBy: { createdAt: "asc" } }),
  ]);
  const registerRows = await Promise.all(
    SHOWN.map(async (k) => [k, (await delegate(k).findMany({ where: { organizationId: orgId }, orderBy: { createdAt: "desc" }, take: 200 })).filter((r) => rowInScope(r, access.frameworks))] as const),
  );
  const fileHref = (id: string) => `/api/public/ms-audit/${token}/files/${id}`;

  return (
    <main className="min-h-[100dvh] bg-slate-50 px-4 py-8">
      <div className="mx-auto flex max-w-5xl flex-col gap-8">
        <header className="flex flex-col gap-2">
          <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">{org?.name}</p>
          <h1 className="text-2xl font-bold text-slate-950">Management system records for audit</h1>
          <p className="text-sm text-slate-600">
            Shared with {access.name}{access.company ? `, ${access.company}` : ""}, read only, until {access.expiresAt.toISOString().slice(0, 10)}. Every visit and download is recorded in the organisation&apos;s audit log.
            Guidance text is not shown: statuses, notes and interpretations are the organisation&apos;s own.
          </p>
          <a href={`/api/public/ms-audit/${token}/pack`} className="self-start rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-black">Download the certification pack (ZIP)</a>
        </header>

        {access.frameworks.map((slug) => {
          const framework = getFramework(slug)!;
          const adoption = adoptions.find((a) => a.frameworkSlug === slug)!;
          const fs = statuses.filter((s) => s.frameworkSlug === slug);
          const fl = links.filter((l) => l.frameworkSlug === slug);
          const byCode = new Map(fs.map((s) => [s.requirementCode, s]));
          const r = readiness(framework, new Map(fs.map((s) => [s.requirementCode, s.status as RequirementState])), new Map(Object.entries(fl.reduce<Record<string, number>>((a, l) => ((a[l.requirementCode] = (a[l.requirementCode] ?? 0) + 1), a), {}))));
          const headings = headingCodes(framework);
          return (
            <section key={slug} className="flex flex-col gap-3">
              <h2 className="text-lg font-semibold text-slate-950">{framework.shortName} <span className="text-sm font-normal text-slate-500">{framework.edition}</span></h2>
              <p className="text-sm tabular-nums text-slate-600">
                {r.implemented} of {r.total - r.notApplicable} applicable requirements implemented; {r.inProgress} in progress; {r.notApplicable} not applicable.
                {adoption.scope ? ` Scope: ${adoption.scope}` : ""}
                {adoption.certificateNumber ? ` Certificate ${adoption.certificateNumber}${adoption.certifiedUntil ? ` valid until ${iso(adoption.certifiedUntil)}` : ""}.` : ""}
              </p>
              <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-slate-200 text-xs text-slate-500">
                    <tr><th className="px-3 py-2">Clause</th><th className="px-3 py-2">Status</th><th className="px-3 py-2">How it is met</th><th className="px-3 py-2">Evidence</th></tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {framework.requirements.map((q) => {
                      if (headings.has(q.code)) return <tr key={q.code} className="bg-slate-50"><td colSpan={4} className="px-3 py-2 text-xs font-semibold text-slate-700">{q.code} {q.title}</td></tr>;
                      const s = byCode.get(q.code);
                      const ev = fl.filter((l) => l.requirementCode === q.code);
                      return (
                        <tr key={q.code} className="align-top">
                          <td className="px-3 py-2"><span className="font-mono text-xs text-slate-500">{q.code}</span> {q.title}</td>
                          <td className="whitespace-nowrap px-3 py-2">{STATE[(s?.status as RequirementState) ?? "not_started"]}</td>
                          <td className="max-w-[360px] whitespace-pre-wrap px-3 py-2 text-slate-700">{[s?.interpretation, s?.notes].filter(Boolean).join("\n\n") || "-"}</td>
                          <td className="px-3 py-2">
                            {ev.length ? (
                              <ul className="flex flex-col gap-1">
                                {ev.map((l) => (
                                  <li key={l.id}>
                                    {l.kind === "evidence_file" && l.targetId ? <a className="underline underline-offset-2" href={fileHref(l.targetId)}>{l.label}</a>
                                      : l.kind === "url" && l.url ? <a className="underline underline-offset-2" href={l.url} target="_blank" rel="noreferrer">{l.label}</a>
                                      : <span>{l.label}</span>}
                                  </li>
                                ))}
                              </ul>
                            ) : "-"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          );
        })}

        {registerRows.map(([key, rows]) => {
          const config = REGISTERS[key];
          if (!rows.length) return null;
          const cols = config.columns.filter((c) => config.fields.some((f) => f.name === c && !["member", "person", "row", "file", "checklist"].includes(f.type)));
          return (
            <section key={key} className="flex flex-col gap-2">
              <h2 className="text-base font-semibold text-slate-950">{config.label}</h2>
              <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-slate-200 text-xs text-slate-500">
                    <tr><th className="px-3 py-2">{config.fields.find((f) => f.name === config.titleField)?.label}</th>{cols.map((c) => <th key={c} className="px-3 py-2">{config.fields.find((f) => f.name === c)?.label}</th>)}</tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {rows.map((row) => (
                      <tr key={row.id} className="align-top">
                        <td className="max-w-[360px] px-3 py-2">
                          {String(row[config.titleField] ?? "")}
                          {typeof row.fileId === "string" && <a className="ml-2 text-xs underline underline-offset-2" href={fileHref(row.fileId)}>file</a>}
                        </td>
                        {cols.map((c) => {
                          const f = config.fields.find((x) => x.name === c)!;
                          const v = row[c];
                          return <td key={c} className="whitespace-nowrap px-3 py-2 text-slate-700">{f.type === "select" ? (f.options?.find(([k]) => k === v)?.[1] ?? iso(v)) : Array.isArray(v) ? v.join(", ") : iso(v)}</td>;
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          );
        })}
      </div>
    </main>
  );
}
