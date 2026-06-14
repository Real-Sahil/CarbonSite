import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { InviteAcceptanceForm } from "./invite-acceptance-form";

interface InvitePageProps {
  params: Promise<{ token: string }>;
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
            Accept this one-time invite to access the organisation workspace.
          </p>
        </div>
        <InviteAcceptanceForm
          token={invite.token}
          orgId={invite.organization.id}
          orgName={invite.organization.name}
          invitedEmail={invite.email}
          role={invite.role}
          expiresAt={invite.expiresAt.toISOString()}
          state={state}
        />
      </div>
    </main>
  );
}
