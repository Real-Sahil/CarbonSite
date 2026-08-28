import { prisma } from "@/lib/db";
import { requireOrgMember, ROLE_GROUPS } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/db/audit";
import { handleRouteError, apiError } from "@/lib/validation/api";
import { z } from "zod";

const assignRoleSchema = z.object({
  userId: z.string().min(1, "User ID is required"),
  role: z.string().min(1, "Role is required"),
});

export async function GET(
  request: Request,
  { params }: { params: Promise<{ orgId: string; projectId: string }> }
) {
  try {
    const { orgId, projectId } = await params;
    const { session, membership } = await requireOrgMember(
      orgId,
      ...ROLE_GROUPS.contractManagers
    );

    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { organizationId: true },
    });

    if (!project || project.organizationId !== orgId) {
      return apiError("PROJECT_NOT_FOUND", "Project not found", 404);
    }

    const members = await prisma.projectRoleAssignment.findMany({
      where: { projectId, organizationId: orgId },
      select: {
        id: true,
        userId: true,
        role: true,
        createdAt: true,
        user: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
        assignedBy: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return Response.json({ members });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ orgId: string; projectId: string }> }
) {
  try {
    const { orgId, projectId } = await params;
    const { session, membership } = await requireOrgMember(
      orgId,
      ...ROLE_GROUPS.contractManagers
    );

    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { organizationId: true, name: true },
    });

    if (!project || project.organizationId !== orgId) {
      return apiError("PROJECT_NOT_FOUND", "Project not found", 404);
    }

    const body = await request.json();
    const { userId, role } = assignRoleSchema.parse(body);

    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return apiError("USER_NOT_FOUND", "User not found", 404);
    }

    const existing = await prisma.projectRoleAssignment.findUnique({
      where: { userId_projectId: { userId, projectId } },
    });

    if (existing) {
      const updated = await prisma.projectRoleAssignment.update({
        where: { id: existing.id },
        data: { role, updatedAt: new Date() },
        select: {
          id: true,
          userId: true,
          role: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      await writeAuditLog({
        organizationId: orgId,
        actorUserId: session.user.id,
        action: "project.member.role_change",
        resourceType: "ProjectRoleAssignment",
        resourceId: updated.id,
        metadata: {
          projectId,
          projectName: project.name,
          userId,
          userEmail: user.email,
          previousRole: existing.role,
          newRole: role,
        },
      });

      return Response.json(updated, { status: 200 });
    }

    const assignment = await prisma.projectRoleAssignment.create({
      data: {
        organizationId: orgId,
        projectId,
        userId,
        role,
        assignedByUserId: session.user.id,
      },
      select: {
        id: true,
        userId: true,
        role: true,
        createdAt: true,
      },
    });

    await writeAuditLog({
      organizationId: orgId,
      actorUserId: session.user.id,
      action: "project.member.added",
      resourceType: "ProjectRoleAssignment",
      resourceId: assignment.id,
      metadata: {
        projectId,
        projectName: project.name,
        userId,
        userEmail: user.email,
        role,
      },
    });

    return Response.json(assignment, { status: 201 });
  } catch (error) {
    return handleRouteError(error);
  }
}
