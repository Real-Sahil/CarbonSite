import { requireOrgMember, AuthError } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { isMissingDatabaseObjectError } from "@/lib/db/prisma-errors";
import { redirect } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import { InviteMemberForm } from "./invite-member-form";
import { InviteLinkGenerator } from "./invite-link-generator";
import { MemberActions } from "./member-actions";
import { FieldWorkerAssignments } from "./field-worker-assignments";
import { PendingInviteActions } from "./pending-invite-actions";

interface MembersPageProps {
  params: Promise<{ orgId: string }>;
}

const ROLE_LABELS: Record<string, string> = {
  admin: "Admin",
  editor: "Editor",
  reviewer: "Reviewer",
  viewer: "Viewer",
  auditor: "Auditor",
  field_worker: "Field Worker",
};

const ROLE_VARIANT: Record<
  string,
  "default" | "secondary" | "outline" | "destructive"
> = {
  admin: "default",
  editor: "secondary",
  reviewer: "secondary",
  viewer: "outline",
  auditor: "outline",
  field_worker: "outline",
};

export default async function MembersPage({ params }: MembersPageProps) {
  const { orgId } = await params;

  let currentUserId: string;
  try {
    const { session } = await requireOrgMember(orgId, "admin");
    currentUserId = session.user.id;
  } catch (err) {
    if (err instanceof AuthError) {
      if (err.status === 401) redirect("/sign-in");
      return (
        <div className="p-8">
          <p className="text-red-600">
          You do not have permission to manage members.
          </p>
        </div>
      );
    }
    throw err;
  }

  // FieldWorkerSiteAssignment is what the mobile app's /my-sites reads —
  // this page manages those rows directly.
  const assignmentQuery = prisma.fieldWorkerSiteAssignment
    .findMany({
      where: { organizationId: orgId },
      include: {
        user: { select: { id: true, name: true, email: true } },
        site: {
          select: { id: true, name: true, project: { select: { name: true } } },
        },
        assignedBy: { select: { name: true, email: true } },
      },
      orderBy: [{ createdAt: "desc" }],
    })
    .then((assignments) => ({ assignments, available: true }))
    .catch((err) => {
      if (isMissingDatabaseObjectError(err)) {
        return { assignments: [], available: false };
      }
      throw err;
    });

  const [org, members, pendingTeamInvites, inviteLinks, sites, assignmentState] =
    await Promise.all([
    prisma.organization.findUniqueOrThrow({
      where: { id: orgId },
      select: { name: true, plan: true },
    }),
    prisma.organizationMembership.findMany({
      where: { organizationId: orgId },
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: "asc" },
    }),
    prisma.inviteLink.findMany({
      where: {
        organizationId: orgId,
        email: { not: null },
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
    prisma.inviteLink.findMany({
      where: {
        organizationId: orgId,
        email: null,
        role: "field_worker",
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
      include: {
        site: {
          select: { id: true, name: true, project: { select: { name: true } } },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
    prisma.site.findMany({
      where: { organizationId: orgId },
      orderBy: { name: "asc" },
      select: { id: true, name: true, project: { select: { name: true } } },
    }),
    assignmentQuery,
  ]);
  const fieldWorkers = members.filter((member) => member.role === "field_worker");
  const assignments = assignmentState.assignments;

  const PLAN_CLASSES: Record<string, string> = {
    trial: "bg-amber-100 text-amber-800 border border-amber-300",
    starter: "bg-blue-100 text-blue-800 border border-blue-300",
    professional: "bg-emerald-100 text-emerald-800 border border-emerald-300",
    enterprise: "bg-purple-100 text-purple-800 border border-purple-300",
  };
  const planClass =
    PLAN_CLASSES[org.plan] ?? "bg-zinc-100 text-zinc-800 border border-zinc-300";

  return (
    <div className="flex flex-col gap-[28px]">
      {/* Plan badge */}
      <div className="flex items-center gap-3">
        <p className="text-sm font-normal text-[#374151] tracking-[-0.42px]">
          {org.name}
        </p>
        <span
          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${planClass}`}
        >
          {org.plan}
        </span>
      </div>

      {/* Members table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Team members</CardTitle>
          <CardDescription>
            {members.length} member{members.length !== 1 ? "s" : ""} in this
            organisation.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0 pb-2">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {members.map((m) => (
                <TableRow key={m.id}>
                  <TableCell className="font-normal text-[#000000]">
                    {m.user.name ?? (
                      <span className="text-[#374151] italic">No name</span>
                    )}
                    {m.user.id === currentUserId && (
                      <span className="ml-2 text-xs text-[#374151]">(you)</span>
                    )}
                  </TableCell>
                  <TableCell className="text-[#374151]">
                    {m.user.email}
                  </TableCell>
                  <TableCell>
                    <Badge variant={ROLE_VARIANT[m.role] ?? "outline"}>
                      {ROLE_LABELS[m.role] ?? m.role}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <MemberActions
                      orgId={orgId}
                      memberId={m.id}
                      memberName={m.user.name ?? m.user.email}
                      currentRole={m.role}
                      isCurrentUser={m.user.id === currentUserId}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Invite by email */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Invite a team member</CardTitle>
          <CardDescription>
            Send a named invitation to add admins, reviewers, auditors, or
            mobile Field Worker users.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <InviteMemberForm orgId={orgId} />
          {pendingTeamInvites.length > 0 && (
            <div className="mt-5 rounded-[14px] border border-[#E5E7EB]">
              <div className="border-b border-[#E5E7EB] px-4 py-3 flex items-center justify-between">
                <p className="text-sm font-normal text-[#111827] tracking-[-0.42px]">
                  Pending email invites
                </p>
                <p className="text-xs text-[#374151]">
                  {pendingTeamInvites.length} pending
                </p>
              </div>
              <div className="divide-y divide-[#e5e7eb]">
                {pendingTeamInvites.map((invite) => (
                  <div
                    key={invite.id}
                    className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div>
                      <p className="text-sm font-normal text-[#111827] tracking-[-0.42px]">
                        {invite.email}
                      </p>
                      <p className="text-xs text-[#374151] tracking-[-0.36px]">
                        {ROLE_LABELS[invite.role] ?? invite.role}
                        {" · "}Expires{" "}
                        {invite.expiresAt.toLocaleDateString("en-GB", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </p>
                    </div>
                    <PendingInviteActions
                      orgId={orgId}
                      inviteId={invite.id}
                      email={invite.email!}
                      role={invite.role}
                      token={invite.token}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Mobile worker site access</CardTitle>
          <CardDescription>
            Grant Field Worker users access to the sites they submit delivery notes,
            waste tickets, fuel receipts, and haulage evidence for. Assigned sites
            appear as projects in the mobile app.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FieldWorkerAssignments
            orgId={orgId}
            assignmentsAvailable={assignmentState.available}
            workers={fieldWorkers.map((member) => ({
              id: member.user.id,
              label: member.user.name ?? "Field worker",
              email: member.user.email,
            }))}
            sites={sites.map((site) => ({
              id: site.id,
              name: site.name,
              projectName: site.project?.name ?? null,
            }))}
            assignments={assignments.map((assignment) => ({
              id: assignment.id,
              userId: assignment.user.id,
              workerLabel: assignment.user.name ?? "Field worker",
              workerEmail: assignment.user.email,
              siteId: assignment.site.id,
              siteLabel: assignment.site.project?.name
                ? `${assignment.site.project.name} — ${assignment.site.name}`
                : assignment.site.name,
              assignedByLabel:
                assignment.assignedBy.name ?? assignment.assignedBy.email,
              createdAt: assignment.createdAt.toISOString(),
            }))}
          />
        </CardContent>
      </Card>

      <Separator />

      {/* Field worker invite links */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Field worker invite links
          </CardTitle>
          <CardDescription>
            Generate a one-time link for subcontractors or field workers. They
            will be onboarded directly via the CarbonSite mobile app without
            needing an email and password. Site-scoped links grant site access
            automatically; org-wide links need a manual site assignment above.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <InviteLinkGenerator
            orgId={orgId}
            initialLinks={inviteLinks.map((l) => ({
              id: l.id,
              token: l.token,
              expiresAt: l.expiresAt,
              role: l.role,
              site: l.site
                ? {
                    id: l.site.id,
                    name: l.site.name,
                    project: l.site.project ? { name: l.site.project.name } : null,
                  }
                : null,
            }))}
          />
        </CardContent>
      </Card>
    </div>
  );
}
