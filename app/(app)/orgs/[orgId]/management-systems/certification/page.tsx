export const dynamic = "force-dynamic";

import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { AuthError, requireOrgMember } from "@/lib/auth/session";
import { MS_EDITORS, MS_READERS } from "@/lib/management-systems/access";
import { getFramework } from "@/lib/management-systems/catalogue";
import { CertificationWorkspace } from "./workspace";

export default async function CertificationPage({ params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params;
  let role: string;
  try {
    const { membership } = await requireOrgMember(orgId, ...MS_READERS);
    role = membership.role;
  } catch (err) {
    if (err instanceof AuthError && err.status === 401) redirect("/sign-in");
    return <div className="p-8 text-sm text-[#6B7280]">You do not have permission to view management systems.</div>;
  }
  const canEdit = (MS_EDITORS as string[]).includes(role);
  const canPack = canEdit || role === "auditor";
  const [adoptions, links] = await Promise.all([
    prisma.msFrameworkAdoption.findMany({ where: { organizationId: orgId, status: { not: "withdrawn" } }, select: { frameworkSlug: true }, orderBy: { createdAt: "asc" } }),
    canEdit
      ? prisma.msAuditorAccess.findMany({
          where: { organizationId: orgId },
          select: { id: true, name: true, email: true, company: true, frameworks: true, expiresAt: true, revokedAt: true, lastUsedAt: true, createdAt: true },
          orderBy: { createdAt: "desc" },
        })
      : Promise.resolve([]),
  ]);
  const frameworks = adoptions.flatMap((a) => {
    const f = getFramework(a.frameworkSlug);
    return f ? [{ slug: f.slug, name: f.shortName }] : [];
  });

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 p-6">
      <div className="flex flex-col gap-1">
        <Link href={`/orgs/${orgId}/management-systems`} className="text-xs text-[#6B7280] hover:text-[#111827]">Management systems</Link>
        <h1 className="text-2xl font-bold tracking-tight text-[#111827]">Certification body access and pack</h1>
        <p className="max-w-[75ch] text-sm text-[#6B7280]">
          Give your certification body&apos;s auditor a read-only link for the frameworks being audited, for as long as the audit needs (up to 90 days), and
          download everything they usually ask for in one ZIP: requirement status with evidence, the Statement of Applicability where the standard has Annex A,
          every register, the training matrix and the files behind them. Remote audit by link is allowed under IAF MD 4 when the certification body has recorded the risks.
        </p>
      </div>
      {frameworks.length === 0 ? (
        <p className="rounded-[14px] border border-dashed border-[#E5E7EB] p-6 text-sm text-[#6B7280]">Adopt a framework first.</p>
      ) : (
        <CertificationWorkspace
          orgId={orgId}
          frameworks={frameworks}
          canEdit={canEdit}
          canPack={canPack}
          links={links.map((l) => ({ ...l, expiresAt: l.expiresAt.toISOString(), revokedAt: l.revokedAt?.toISOString() ?? null, lastUsedAt: l.lastUsedAt?.toISOString() ?? null, createdAt: l.createdAt.toISOString() }))}
        />
      )}
    </div>
  );
}
