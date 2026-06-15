import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isMissingDatabaseObjectError } from "@/lib/db/prisma-errors";
import { requireOrgMember } from "@/lib/auth/session";
import { handleRouteError } from "@/lib/validation/api";

// Sites assigned to the calling field worker. Drives the mobile "My Projects"
// screen — each site is a place the worker can submit field evidence against.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ orgId: string }> },
) {
  try {
    const { orgId } = await params;
    const { session, membership } = await requireOrgMember(
      orgId,
      "admin",
      "editor",
      "reviewer",
      "field_worker",
    );

    try {
      const assignments = await prisma.fieldWorkerSiteAssignment.findMany({
        where: {
          organizationId: orgId,
          // field workers see only their own; org members see all assignments
          ...(membership.role === "field_worker" ? { userId: session.user.id } : {}),
        },
        include: {
          site: {
            select: {
              id: true,
              name: true,
              siteCode: true,
              postcode: true,
              city: true,
              project: {
                select: { id: true, name: true, status: true, startDate: true, endDate: true },
              },
            },
          },
        },
        orderBy: { createdAt: "desc" },
      });

      const sites = assignments
        .filter((a) => a.site !== null)
        .map((a) => ({
          assignmentId: a.id,
          id: a.site.id,
          name: a.site.name,
          siteCode: a.site.siteCode,
          postcode: a.site.postcode,
          city: a.site.city,
          projectId: a.site.project?.id ?? null,
          projectName: a.site.project?.name ?? null,
          projectStatus: a.site.project?.status ?? null,
          startDate: a.site.project?.startDate ?? null,
          endDate: a.site.project?.endDate ?? null,
        }));

      return NextResponse.json(sites);
    } catch (err) {
      // Migration not yet applied — return empty so the app degrades gracefully.
      if (isMissingDatabaseObjectError(err)) {
        return NextResponse.json([]);
      }
      throw err;
    }
  } catch (err) {
    return handleRouteError(err);
  }
}
