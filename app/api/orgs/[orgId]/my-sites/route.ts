import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireOrgMember } from "@/lib/auth/session";
import { handleRouteError } from "@/lib/validation/api";

// GET /api/orgs/[orgId]/my-sites
//
// Returns the sites this field worker is assigned to, shaped for the Flutter
// mobile app. Each item includes the parent project name and date range so the
// app can show meaningful labels without a second request.
//
// Admins and editors see all sites in the org (they can submit on behalf of
// any site). Field workers see only their own assignments.

type Params = { params: Promise<{ orgId: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { orgId } = await params;
    const { session, membership } = await requireOrgMember(
      orgId,
      "admin",
      "editor",
      "reviewer",
      "field_worker",
    );

    const isFieldWorker = membership.role === "field_worker";

    if (isFieldWorker) {
      const assignments = await prisma.fieldWorkerSiteAssignment.findMany({
        where: { organizationId: orgId, userId: session.user.id },
        include: {
          site: {
            select: {
              id: true,
              name: true,
              postcode: true,
              organizationId: true,
              project: {
                select: {
                  name: true,
                  startDate: true,
                  endDate: true,
                  status: true,
                },
              },
            },
          },
        },
        orderBy: { createdAt: "desc" },
      });

      const data = assignments.map((a) => ({
        assignmentId: a.id,
        id: a.site.id,
        name: a.site.name,
        postcode: a.site.postcode,
        organizationId: a.site.organizationId,
        projectName: a.site.project.name,
        startDate: a.site.project.startDate?.toISOString().slice(0, 10) ?? "",
        endDate: a.site.project.endDate?.toISOString().slice(0, 10) ?? "",
        projectStatus: a.site.project.status,
      }));

      return NextResponse.json(data);
    }

    // Admins / editors / reviewers see all sites in the org.
    const sites = await prisma.site.findMany({
      where: { organizationId: orgId },
      select: {
        id: true,
        name: true,
        postcode: true,
        organizationId: true,
        project: {
          select: {
            name: true,
            startDate: true,
            endDate: true,
            status: true,
          },
        },
      },
      orderBy: { name: "asc" },
    });

    const data = sites.map((s) => ({
      assignmentId: null,
      id: s.id,
      name: s.name,
      postcode: s.postcode,
      organizationId: s.organizationId,
      projectName: s.project.name,
      startDate: s.project.startDate?.toISOString().slice(0, 10) ?? "",
      endDate: s.project.endDate?.toISOString().slice(0, 10) ?? "",
      projectStatus: s.project.status,
    }));

    return NextResponse.json(data);
  } catch (err) {
    return handleRouteError(err);
  }
}
