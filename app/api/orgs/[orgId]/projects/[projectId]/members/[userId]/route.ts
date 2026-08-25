import { prisma } from "@/lib/db";
import { requireOrgMember, ROLE_GROUPS } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/db/audit";
import { handleRouteError, apiError } from "@/lib/validation/api";

export async function DELETE(
  request: Request,
  { params }: {
    params: Promise<{ orgId: string; projectId: string; userId: string }>;
  }
) {
  try {
    const { orgId, projectId, userId } = await params;
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

    const assignment = await prisma.projectRoleAssignment.findUnique({
      where: { userId_projectId: { userId, projectId } },
      select: {
        id: true,
        role: true,
        user: {
          select: {
            email: true,
            name: true,
          },
        },
      },
    });

    if (!assignment) {
      return apiError("ASSIGNMENT_NOT_FOUND", "User is not assigned to this project", 404);
    }

    await prisma.projectRoleAssignment.delete({
      where: { userId_projectId: { userId, projectId } },
    });

    await writeAuditLog({
      organizationId: orgId,
      actorUserId: session.user.id,
      action: "project.member.removed",
      resourceType: "ProjectRoleAssignment",
      resourceId: assignment.id,
      metadata: {
        projectId,
        projectName: project.name,
        userId,
        userEmail: assignment.user.email,
        removedRole: assignment.role,
      },
    });

    return Response.json({ success: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
