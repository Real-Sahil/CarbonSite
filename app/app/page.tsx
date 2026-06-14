import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";

// Landing point after sign-in. Looks up the user's first org and redirects
// to its dashboard. If no org exists yet, sends them to the org creation flow.
export default async function AppEntryPage() {
  const session = await getSession();
  if (!session) redirect("/sign-in");

  const membership = await prisma.organizationMembership.findFirst({
    where: { userId: session.user.id },
    orderBy: { createdAt: "asc" },
    select: { organizationId: true },
  });

  if (!membership) redirect("/orgs/new");

  redirect(`/orgs/${membership.organizationId}/dashboard`);
}
