import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { prisma } from "@/lib/db";
import { InviteAcceptanceForm } from "./invite-acceptance-form";
import { MobileAppInvite } from "./mobile-app-invite";

interface InvitePageProps {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ webform?: string }>;
}

// iPadOS Safari sends a desktop Mac user agent by default, so a Mac agent is
// treated as a possible iPad here; MobileAppInvite checks for a touch screen
// and sends a real Mac to the web form.
function isMobileUserAgent(ua: string): boolean {
  return /android|iphone|ipad|ipod|macintosh/i.test(ua);
}

export default async function InvitePage({ params, searchParams }: InvitePageProps) {
  const { token } = await params;
  const { webform } = await searchParams;

  // The store reviewers' demo link (DEMO_REVIEWER_TOKEN) is not an invite
  // row: it only opens the app, which signs in to the demo organisation.
  const demoToken = process.env.DEMO_REVIEWER_TOKEN;
  if (demoToken && demoToken.length >= 24 && token === demoToken) {
    return (
      <main className="min-h-screen bg-slate-50 px-4 py-10">
        <div className="mx-auto flex max-w-md flex-col gap-6">
          <h1 className="text-2xl font-bold text-slate-950">MetricOra demo</h1>
          <MobileAppInvite token={token} orgName="MetricOra Demo" appOnly />
        </div>
      </main>
    );
  }

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
  const forceWebForm = webform === "1";
  const showMobileFirst = isFieldWorkerRole && isMobileUserAgent(ua) && !forceWebForm;

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10">
      <div className="mx-auto flex max-w-md flex-col gap-6">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-[#0F766E]">
            MetricOra invite
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
