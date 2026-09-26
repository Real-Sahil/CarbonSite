export const dynamic = "force-dynamic";

import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { AuthError, requireOrgMember } from "@/lib/auth/session";
import { MS_EDITORS, MS_READERS } from "@/lib/management-systems/access";
import { REGISTERS, REGISTER_KEYS, isRegisterKey } from "@/lib/management-systems/registers/config";
import { listRows } from "@/lib/management-systems/registers/server";
import { FRAMEWORKS } from "@/lib/management-systems/catalogue";
import { RegisterWorkspace } from "./register-workspace";

export default async function RegisterPage({ params }: { params: Promise<{ orgId: string; register: string }> }) {
  const { orgId, register } = await params;
  if (!isRegisterKey(register)) notFound();
  let role: string;
  try {
    const { membership } = await requireOrgMember(orgId, ...MS_READERS);
    role = membership.role;
  } catch (err) {
    if (err instanceof AuthError && err.status === 401) redirect("/sign-in");
    return <div className="p-8 text-sm text-[#6B7280]">You do not have permission to view management systems.</div>;
  }
  const config = REGISTERS[register];
  const [rows, members, audits] = await Promise.all([
    listRows(orgId, register),
    prisma.organizationMembership.findMany({
      where: { organizationId: orgId, role: { notIn: ["field_worker", "supplier"] } },
      select: { user: { select: { id: true, name: true, email: true } } },
    }),
    config.fields.some((f) => f.type === "audit")
      ? prisma.msAudit.findMany({ where: { organizationId: orgId }, select: { id: true, title: true }, orderBy: { createdAt: "desc" } })
      : Promise.resolve([]),
  ]);

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 p-6">
      <div className="flex flex-col gap-1">
        <Link href={`/orgs/${orgId}/management-systems`} className="text-xs text-[#6B7280] hover:text-[#111827]">Management systems</Link>
        <h1 className="text-2xl font-bold tracking-tight text-[#111827]">{config.label}</h1>
        <p className="max-w-[75ch] text-sm text-[#6B7280]">{config.intro}</p>
      </div>
      <nav aria-label="Registers" className="flex flex-wrap gap-2">
        {REGISTER_KEYS.map((k) => (
          <Link
            key={k}
            href={`/orgs/${orgId}/management-systems/registers/${k}`}
            aria-current={k === register ? "page" : undefined}
            className={`rounded-full px-3 py-1 text-xs ${k === register ? "bg-[#111827] text-white" : "border border-[#E5E7EB] text-[#374151] hover:bg-[#F9FAFB]"}`}
          >
            {REGISTERS[k].label}
          </Link>
        ))}
      </nav>
      <RegisterWorkspace
        orgId={orgId}
        registerKey={register}
        rows={rows as Array<Record<string, unknown> & { id: string }>}
        canEdit={(MS_EDITORS as string[]).includes(role)}
        members={members.map((m) => ({ id: m.user.id, name: m.user.name || m.user.email })).sort((a, b) => a.name.localeCompare(b.name))}
        audits={audits.map((a) => ({ id: a.id, name: a.title }))}
        frameworks={FRAMEWORKS.map((f) => ({ id: f.slug, name: f.shortName }))}
      />
    </div>
  );
}
