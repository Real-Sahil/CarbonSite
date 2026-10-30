export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { getSelectedProject } from "@/lib/project/selected";
import { requireOrgMember, AuthError, ROLE_GROUPS } from "@/lib/auth/session";
import { EarthySummary } from "./earthy-summary";

interface DashboardPageProps {
  params: Promise<{ orgId: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}

export default async function DashboardPage({ params, searchParams }: DashboardPageProps) {
  const { orgId } = await params;
  const rawParams = await searchParams;
  // A bare dashboard link opens on the project picked in the sidebar. Choosing "All projects"
  // clears that preference first, so removing the project filter does not bring it back.
  if (Object.keys(rawParams).length === 0) {
    const chosen = await getSelectedProject(orgId);
    if (chosen) redirect(`/orgs/${orgId}/dashboard?projectId=${encodeURIComponent(chosen.id)}`);
  }
  let session: Awaited<ReturnType<typeof requireOrgMember>>["session"];
  let membership: Awaited<ReturnType<typeof requireOrgMember>>["membership"];
  try {
    const result = await requireOrgMember(orgId, ...ROLE_GROUPS.anyMember);
    session = result.session;
    membership = result.membership;
  } catch (err) {
    if (err instanceof AuthError) {
      if (err.status === 401) redirect("/sign-in");
      redirect("/");
    }
    return <div className="p-8"><p className="text-sm text-red-600">Failed to load dashboard. The database may be updating, so try refreshing in a moment.</p></div>;
  }

  // Field workers and suppliers have no visibility into org emissions data
  // (the org layout sends them away first; kept as a second guard).
  if (membership!.role === "field_worker") redirect("/app");
  if (membership!.role === "supplier") redirect("/supplier-portal");

  return <EarthySummary orgId={orgId} firstName={session!.user.name?.split(" ")[0] ?? null} />;
}
