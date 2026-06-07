import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";

export default async function RootPage() {
  const session = await getSession();

  if (!session) {
    redirect("/sign-in");
  }

  const membership = await prisma.organizationMembership.findFirst({
    where: { userId: session.user.id },
    orderBy: { createdAt: "asc" },
    select: { organizationId: true },
  });

  if (membership) {
    redirect(`/orgs/${membership.organizationId}/dashboard`);
  } else {
    redirect("/orgs/new");
  }
}
