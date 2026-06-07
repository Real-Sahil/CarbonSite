import { requireOrgMember, AuthError } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
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
    const { session } = await requireOrgMember(orgId, "admin", "editor");
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

  const [members, inviteLinks] = await Promise.all([
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
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
  ]);

  return (
    <div className="p-8 max-w-4xl mx-auto flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">
          Members &amp; Access
        </h1>
        <p className="text-slate-500 mt-1">
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
              </TableRow>
            </TableHeader>
            <TableBody>
              {members.map((m) => (
                <TableRow key={m.id}>
                  <TableCell className="font-medium">
                    {m.user.name ?? (
                      <span className="text-slate-400 italic">No name</span>
                    )}
                    {m.user.id === currentUserId && (
                      <span className="ml-2 text-xs text-slate-400">(you)</span>
                    )}
                  </TableCell>
                  <TableCell className="text-slate-600">
                    {m.user.email}
                  </TableCell>
                  <TableCell>
                    <Badge variant={ROLE_VARIANT[m.role] ?? "outline"}>
                      {ROLE_LABELS[m.role] ?? m.role}
                    </Badge>
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
            Send an email invitation to add a sustainability manager, auditor, or
            other team member.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <InviteMemberForm orgId={orgId} />
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
            needing an email and password.
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
