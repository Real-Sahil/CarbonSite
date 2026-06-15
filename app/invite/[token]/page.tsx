import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { prisma } from "@/lib/db";
import { InviteAcceptanceForm } from "./invite-acceptance-form";
import { MobileAppInvite } from "./mobile-app-invite";

interface InvitePageProps {
  params: Promise<{ token: string }>;
}

function isMobileUserAgent(ua: string): boolean {
  return /android|iphone|ipad|ipod/i.test(ua);
}

export default async function InvitePage({ params }: InvitePageProps) {
  const { token } = await params;
  const invite = await prisma.inviteLink.findUnique({
    where: { token },
    include: { organization: { select: { id: true, name: true } } },
  });

  if (!invite) notFound();

  const now = new Date();
  const state =
    invite.usedAt !== null ? "used" : invite.expiresAt <= now ? "expired" : "active";

  const headersList = await headers();
  const ua = headersList.get("user-agent") ?? "";
  const isFieldWorkerRole = invite.role === "field_worker";
  const showMobileFirst = isFieldWorkerRole && isMobileUserAgent(ua);

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10">
      <div className="mx-auto flex max-w-md flex-col gap-6">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-green-700">
            CarbonSite invite
          </p>
          <h1 className="mt-2 text-2xl font-bold text-slate-950">
            Join {invite.organization.name}
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            {isFieldWorkerRole
              ? "You've been invited to submit field records for this organisation."
              : "Accept this one-time invite to access the organisation workspace."}
          </p>
        </div>

        {/* Field workers on mobile get the app-open flow first */}
        {showMobileFirst && state === "active" ? (
          <MobileAppInvite
            token={invite.token}
            orgName={invite.organization.name}
          />
        ) : (
          <InviteAcceptanceForm
            token={invite.token}
            orgId={invite.organization.id}
            orgName={invite.organization.name}
            invitedEmail={invite.email}
            role={invite.role}
            expiresAt={invite.expiresAt.toISOString()}
            state={state}
          />
        )}
      </div>
    </main>
  );
}
