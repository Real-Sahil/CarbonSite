import { redirect } from "next/navigation";
import { Smartphone } from "lucide-react";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";

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
      <div className="min-h-screen flex items-center justify-center bg-[#fffefc] p-8">
        <div className="max-w-md text-center">
          <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-[14px] bg-[#e1f4df]">
            <Smartphone aria-hidden="true" className="h-7 w-7 text-[#0f3e17]" />
          </div>
          <h1
            className="text-[28px] leading-[1.35] tracking-[-0.4px] text-[#0f3e17]"
            style={{ fontFamily: "var(--font-fraunces, Fraunces, Georgia, serif)", fontWeight: 300 }}
          >
            Use the CarbonSite mobile app
          </h1>
          <p className="mt-3 text-sm text-[#222222] tracking-[-0.42px]">
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
