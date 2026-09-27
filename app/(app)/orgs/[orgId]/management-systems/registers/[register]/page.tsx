export const dynamic = "force-dynamic";

import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { AuthError, requireOrgMember } from "@/lib/auth/session";
import { MS_EDITORS, MS_READERS } from "@/lib/management-systems/access";
import { REGISTERS, REGISTER_GROUPS, isRegisterKey, type RegisterKey } from "@/lib/management-systems/registers/config";
import { checklistItems, listRows, refOptions } from "@/lib/management-systems/registers/server";
import { loadAcknowledgements } from "@/lib/management-systems/acknowledgements";
import { FRAMEWORKS } from "@/lib/management-systems/catalogue";
import { RegisterWorkspace } from "./register-workspace";

export default async function RegisterPage({ params }: { params: Promise<{ orgId: string; register: string }> }) {
  const { orgId, register } = await params;
  if (!isRegisterKey(register)) notFound();
  let role: string;
  let userId: string;
  try {
    const { membership, session } = await requireOrgMember(orgId, ...MS_READERS);
    role = membership.role;
    userId = session.user.id;
  } catch (err) {
    if (err instanceof AuthError && err.status === 401) redirect("/sign-in");
    return <div className="p-8 text-sm text-[#6B7280]">You do not have permission to view management systems.</div>;
  }
  const config = REGISTERS[register];
  const refKeys = [...new Set(config.fields.flatMap((f) => (f.type === "row" && f.ref ? [f.ref] : [])))] as RegisterKey[];
  const needsFiles = config.fields.some((f) => f.type === "file");
  const needsChecklists = config.fields.some((f) => f.type === "checklist");

  const [rawRows, memberships, refs, files, templates] = await Promise.all([
    listRows(orgId, register),
    prisma.organizationMembership.findMany({
      where: { organizationId: orgId, role: { not: "supplier" } },
      select: { role: true, user: { select: { id: true, name: true, email: true } } },
    }),
    Promise.all(refKeys.map(async (k) => [k, await refOptions(orgId, k)] as const)),
    needsFiles
      ? prisma.evidenceFile.findMany({ where: { organizationId: orgId }, select: { id: true, filename: true }, orderBy: { createdAt: "desc" }, take: 300 })
      : Promise.resolve([]),
    needsChecklists
      ? prisma.msInspectionTemplate.findMany({ where: { organizationId: orgId }, select: { id: true, items: true } })
      : Promise.resolve([]),
  ]);
  const rows = rawRows as Array<Record<string, unknown> & { id: string }>;
  const acks = config.acknowledgeable ? await loadAcknowledgements(orgId, register, rows, userId) : {};

  const named = (m: (typeof memberships)[number]) => ({ id: m.user.id, name: m.user.name || m.user.email });
  const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name);
  const webMembers = memberships.filter((m) => m.role !== "field_worker");

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 p-6">
      <div className="flex flex-col gap-1">
        <Link href={`/orgs/${orgId}/management-systems`} className="text-xs text-[#6B7280] hover:text-[#111827]">Management systems</Link>
        <h1 className="text-2xl font-bold tracking-tight text-[#111827]">{config.label}</h1>
        <p className="max-w-[75ch] text-sm text-[#6B7280]">{config.intro}</p>
        {register === "training-records" || register === "competences" ? (
          <Link href={`/orgs/${orgId}/management-systems/training-matrix`} className="mt-1 self-start text-sm underline underline-offset-2">Open the training matrix</Link>
        ) : null}
      </div>
      <nav aria-label="Registers" className="flex flex-col gap-2">
        {REGISTER_GROUPS.map((g) => (
          <div key={g.label} className="flex flex-wrap items-center gap-2">
            <span className="w-32 shrink-0 text-xs font-medium text-[#6B7280]">{g.label}</span>
            {g.keys.map((k) => (
              <Link
                key={k}
                href={`/orgs/${orgId}/management-systems/registers/${k}`}
                aria-current={k === register ? "page" : undefined}
                className={`rounded-full px-3 py-1 text-xs ${k === register ? "bg-[#111827] text-white" : "border border-[#E5E7EB] text-[#374151] hover:bg-[#F9FAFB]"}`}
              >
                {REGISTERS[k].label}
              </Link>
            ))}
          </div>
        ))}
      </nav>
      <RegisterWorkspace
        orgId={orgId}
        registerKey={register}
        rows={rows}
        canEdit={(MS_EDITORS as string[]).includes(role)}
        members={webMembers.map(named).sort(byName)}
        people={memberships.map(named).sort(byName)}
        refs={Object.fromEntries(refs)}
        files={files.map((f) => ({ id: f.id, name: f.filename }))}
        checklists={Object.fromEntries(templates.map((t) => [t.id, checklistItems(t.items)]))}
        frameworks={FRAMEWORKS.map((f) => ({ id: f.slug, name: f.shortName }))}
        acks={acks}
        webMemberCount={webMembers.length}
      />
    </div>
  );
}
