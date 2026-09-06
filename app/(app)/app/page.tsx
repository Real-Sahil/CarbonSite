import { redirect } from "next/navigation";
import { Smartphone } from "lucide-react";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function AppEntryPage() {
  const session = await getSession();

  if (!session) {
    redirect("/sign-in");
  }

  const memberships = await prisma.organizationMembership.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "asc" },
    select: { organizationId: true, role: true },
  });

  // The web app has no surface for field workers — every org page would
  // deny them. Point them at the mobile app instead of a dead end.
  const nonFieldMembership = memberships.find((m) => m.role !== "field_worker");
  if (!nonFieldMembership && memberships.length > 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white p-8">
        <div className="max-w-md text-center">
          <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-[14px] bg-[#F0F9FF]">
            <Smartphone aria-hidden="true" className="h-7 w-7 text-[#111827]" />
          </div>
          <h1
            className="text-[28px] leading-[1.35] tracking-[-0.4px] text-[#111827]"
            
          >
            Use the MetricOra mobile app
          </h1>
          <p className="mt-3 text-sm text-[#374151] tracking-[-0.42px]">
            Your account is a field worker account — submissions, photos, and
            statuses live in the mobile app. Open the invite link from your
            administrator on your phone to get set up.
          </p>
        </div>
      </div>
    );
  }

  redirect(
    nonFieldMembership
      ? `/orgs/${nonFieldMembership.organizationId}/dashboard`
      : "/orgs/new",
  );
}
