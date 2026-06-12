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

  const assignmentQuery = prisma.fieldWorkerAssignment
    .findMany({
      where: { organizationId: orgId },
      include: {
        user: { select: { id: true, name: true, email: true } },
        reportingPeriod: { select: { id: true, label: true } },
        facility: { select: { name: true } },
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

  const [members, pendingTeamInvites, inviteLinks, periods, facilities, assignmentState] =
    await Promise.all([
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
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
    prisma.reportingPeriod.findMany({
      where: { organizationId: orgId },
      orderBy: [{ startDate: "desc" }, { createdAt: "desc" }],
      select: { id: true, label: true, status: true, startDate: true, endDate: true },
    }),
    prisma.facility.findMany({
      where: { organizationId: orgId },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    assignmentQuery,
  ]);
  const fieldWorkers = members.filter((member) => member.role === "field_worker");
  const assignments = assignmentState.assignments;

  return (
    <div className="p-[42px] max-w-[900px] mx-auto flex flex-col gap-[42px]">
      <div className="mb-0">
        <p className="text-xs font-normal tracking-[-0.36px] text-[#0f3e17] bg-[#b6ced5] rounded-full px-[14px] py-[7px] inline-flex mb-[14px]">
          Settings
        </p>
        <h1
          className="text-[40px] leading-[1.35] tracking-[-0.4px] text-[#0f3e17]"
          style={{ fontFamily: "var(--font-fraunces, Fraunces, Georgia, serif)", fontWeight: 300 }}
        >
          Members &amp; Access
        </h1>
        <p className="text-sm text-[#222222] font-normal tracking-[-0.42px] mt-[7px]">
          Manage who has access to your organisation and their roles.
        </p>
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
                      <span className="text-[#333333] italic">No name</span>
                    )}
                    {m.user.id === currentUserId && (
                      <span className="ml-2 text-xs text-[#333333]">(you)</span>
                    )}
                  </TableCell>
                  <TableCell className="text-[#222222]">
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
            <div className="mt-5 rounded-[14px] border border-[#e5e7eb]">
              <div className="border-b border-[#e5e7eb] px-4 py-3">
                <p className="text-sm font-normal text-[#0f3e17] tracking-[-0.42px]">Pending email invites</p>
              </div>
              <div className="divide-y divide-[#e5e7eb]">
                {pendingTeamInvites.map((invite) => (
                  <div
                    key={invite.id}
                    className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div>
                      <p className="text-sm font-normal text-[#0f3e17] tracking-[-0.42px]">{invite.email}</p>
                      <p className="text-xs text-[#333333] tracking-[-0.36px]">
                        {ROLE_LABELS[invite.role] ?? invite.role}
                      </p>
                    </div>
                    <p className="text-xs text-[#333333] tracking-[-0.36px]">
                      Expires{" "}
                      {invite.expiresAt.toLocaleDateString("en-GB", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Mobile worker assignments</CardTitle>
          <CardDescription>
            Assign Field Worker users to the reporting periods and sites they can
            submit delivery notes, waste tickets, fuel receipts, and haulage evidence for.
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
            periods={periods.map((period) => ({
              id: period.id,
              label: period.label,
              status: period.status,
              startDate: period.startDate.toISOString(),
              endDate: period.endDate.toISOString(),
            }))}
            facilities={facilities.map((facility) => ({
              id: facility.id,
              name: facility.name,
            }))}
            assignments={assignments.map((assignment) => ({
              id: assignment.id,
              userId: assignment.user.id,
              workerLabel: assignment.user.name ?? "Field worker",
              workerEmail: assignment.user.email,
              reportingPeriodId: assignment.reportingPeriod.id,
              reportingPeriodLabel: assignment.reportingPeriod.label,
              facilityName: assignment.facility?.name ?? null,
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
            needing an email and password, then can be assigned to projects here
            after accepting.
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
            }))}
          />
        </CardContent>
      </Card>
    </div>
  );
}
