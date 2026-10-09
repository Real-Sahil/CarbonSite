export const dynamic = "force-dynamic";

import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireOrgMember, ROLE_GROUPS, AuthError } from "@/lib/auth/session";
import { LINK_ISSUERS } from "@/lib/evidence/submission-link";
import { getSelectedProject } from "@/lib/project/selected";
import { DOC_KINDS, KIND_VALUES, documentState, kindLabel } from "@/lib/waste/documents";
import { SubmissionLinks } from "../../records/submission-links";
import { AddDocument, DocumentActions } from "./document-actions";

const STATE_CLS: Record<string, string> = {
  expired: "bg-red-100 text-red-700",
  expiring: "bg-amber-100 text-amber-800",
  ok: "bg-green-100 text-green-700",
};
const STATE_LABEL: Record<string, string> = { expired: "Expired", expiring: "Expires within 30 days", ok: "In date" };
const day = (d: Date) => d.toISOString().slice(0, 10);

export default async function WasteDocumentsPage({ params, searchParams }: { params: Promise<{ orgId: string }>; searchParams: Promise<{ kind?: string; status?: string }> }) {
  const { orgId } = await params;
  const sp = await searchParams;
  let canEdit = false;
  try {
    const { membership } = await requireOrgMember(orgId, ...ROLE_GROUPS.dataReaders);
    canEdit = LINK_ISSUERS.includes(membership.role);
  } catch (err) {
    if (err instanceof AuthError) redirect("/sign-in");
    throw err;
  }
  const kind = sp.kind && KIND_VALUES.includes(sp.kind) ? sp.kind : null;
  const status = sp.status && ["pending", "accepted", "rejected"].includes(sp.status) ? sp.status : null;
  const project = await getSelectedProject(orgId);

  const [docs, projects, facilities, periods] = await Promise.all([
    prisma.wasteDocument.findMany({
      where: { organizationId: orgId, ...(kind ? { kind } : {}), ...(status ? { status } : {}), ...(project ? { projectId: project.id } : {}) },
      orderBy: { createdAt: "desc" },
      take: 300,
    }),
    prisma.project.findMany({ where: { organizationId: orgId }, select: { id: true, name: true }, orderBy: { name: "asc" }, take: 500 }),
    prisma.facility.findMany({ where: { organizationId: orgId }, select: { id: true, name: true }, orderBy: { name: "asc" }, take: 500 }),
    prisma.reportingPeriod.findMany({ where: { organizationId: orgId }, select: { id: true, label: true }, orderBy: { startDate: "desc" }, take: 100 }),
  ]);
  const projectName = new Map(projects.map((p) => [p.id, p.name]));
  const pending = docs.filter((d) => d.status === "pending").length;
  const lapsed = docs.filter((d) => d.status === "accepted" && ["expired", "expiring"].includes(documentState(d.kind, d.validUntil))).length;
  const tab = (q: Record<string, string | null>) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries({ kind, status, ...q })) if (v) p.set(k, v);
    const s = p.toString();
    return s ? `?${s}` : "?";
  };

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 tracking-tight">Waste documents</h1>
          <p className="mt-1 text-sm text-gray-500">Transfer notes, carrier licences, site permits and exemptions in one place, with expiry dates and who sent them.</p>
          <Link href={`/orgs/${orgId}/waste`} className="mt-2 inline-block text-sm font-medium text-teal-700 hover:text-teal-800">Back to waste</Link>
        </div>
        {canEdit && <AddDocument orgId={orgId} projects={projects} defaultProjectId={project?.id ?? null} />}
      </div>

      {project && (
        <p className="mb-4 rounded-lg bg-[#F9FAFB] px-4 py-2 text-sm text-[#374151]">
          Showing documents for <span className="font-medium">{project.name}</span>. Change the project in the sidebar to see all.
        </p>
      )}

      <div className="mb-4 flex flex-wrap items-center gap-2 text-xs">
        <Link href={tab({ kind: null })} className={`rounded-full border px-3 py-1 ${!kind ? "border-[#111827] bg-[#111827] text-white" : "border-[#E5E7EB] text-[#374151]"}`}>All kinds</Link>
        {DOC_KINDS.map((k) => (
          <Link key={k.value} href={tab({ kind: k.value })} className={`rounded-full border px-3 py-1 ${kind === k.value ? "border-[#111827] bg-[#111827] text-white" : "border-[#E5E7EB] text-[#374151]"}`}>{k.label}</Link>
        ))}
        <span className="mx-2 text-gray-300">|</span>
        <Link href={tab({ status: null })} className={`rounded-full border px-3 py-1 ${!status ? "border-[#111827] bg-[#111827] text-white" : "border-[#E5E7EB] text-[#374151]"}`}>Any status</Link>
        <Link href={tab({ status: "pending" })} className={`rounded-full border px-3 py-1 ${status === "pending" ? "border-[#111827] bg-[#111827] text-white" : "border-[#E5E7EB] text-[#374151]"}`}>Waiting for you{pending > 0 && !status ? ` (${pending})` : ""}</Link>
      </div>
      {lapsed > 0 && <p role="status" className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-900">{lapsed} {lapsed === 1 ? "document has" : "documents have"} expired or expire within 30 days.</p>}

      {canEdit && <div className="mb-6"><SubmissionLinks orgId={orgId} purpose="waste_documents" /></div>}

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        {docs.length === 0 ? (
          <p className="p-10 text-center text-sm text-gray-500">No documents yet. Add one, or send a contractor an upload link.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b border-gray-100">
              <tr>{["Document", "Kind", "Covers", "Valid until", "From", "Status", ""].map((h) => <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">{h}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {docs.map((d) => {
                const st = documentState(d.kind, d.validUntil);
                return (
                  <tr key={d.id}>
                    <td className="px-4 py-3">
                      <a href={`/api/orgs/${orgId}/evidence/${d.evidenceFileId}/download`} className="font-medium text-gray-900 underline underline-offset-2">{d.title}</a>
                      {d.reference && <div className="text-xs text-gray-500">Ref {d.reference}</div>}
                      {d.projectId && <div className="text-xs text-gray-500">{projectName.get(d.projectId) ?? "Project"}</div>}
                    </td>
                    <td className="px-4 py-3 text-gray-600">{kindLabel(d.kind)}</td>
                    <td className="px-4 py-3 text-gray-600">{d.issuer ?? "-"}</td>
                    <td className="px-4 py-3">
                      {d.validUntil ? <>{day(d.validUntil)} {STATE_CLS[st] && <span className={`ml-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${STATE_CLS[st]}`}>{STATE_LABEL[st]}</span>}</> : "-"}
                    </td>
                    <td className="px-4 py-3 text-gray-600">{d.uploaderName ? `${d.uploaderName}${d.uploaderCompany ? `, ${d.uploaderCompany}` : ""}` : "Our team"}</td>
                    <td className="px-4 py-3 capitalize text-gray-600">{d.status}</td>
                    <td className="px-4 py-3">{canEdit && <DocumentActions orgId={orgId} id={d.id} kind={d.kind} status={d.status} extracted={(d.extracted as never) ?? null} recorded={!!d.wasteRecordId} prefill={{ reference: d.reference, issuer: d.issuer, projectId: d.projectId }} facilities={facilities} periods={periods} />}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
