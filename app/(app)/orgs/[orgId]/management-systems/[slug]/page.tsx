export const dynamic = "force-dynamic";

import { notFound, redirect } from "next/navigation";
import { AuthError, requireOrgMember } from "@/lib/auth/session";
import { MS_EDITORS, MS_READERS } from "@/lib/management-systems/access";
import { loadFrameworkView } from "@/lib/management-systems/load";
import { FrameworkWorkspace } from "./workspace";

export default async function FrameworkPage({ params }: { params: Promise<{ orgId: string; slug: string }> }) {
  const { orgId, slug } = await params;
  let role: string;
  try {
    const { membership } = await requireOrgMember(orgId, ...MS_READERS);
    role = membership.role;
  } catch (err) {
    if (err instanceof AuthError && err.status === 401) redirect("/sign-in");
    return <div className="p-8 text-sm text-[#6B7280]">You do not have permission to view management systems.</div>;
  }
  const view = await loadFrameworkView(orgId, slug);
  if (!view) notFound();
  return <FrameworkWorkspace orgId={orgId} view={view} canEdit={(MS_EDITORS as string[]).includes(role)} />;
}
