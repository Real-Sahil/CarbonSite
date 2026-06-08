import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";

export default async function AppEntryPage() {
  const session = await getSession();

  if (!session) {
    redirect("/sign-in");
  }

  const membership = await prisma.organizationMembership.findFirst({
    where: { userId: session.user.id },
    orderBy: { createdAt: "asc" },
    select: { organizationId: true },
  });

  redirect(
    membership ? `/orgs/${membership.organizationId}/dashboard` : "/orgs/new",
  );
}
