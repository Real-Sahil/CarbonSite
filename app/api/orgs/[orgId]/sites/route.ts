import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireOrgMember } from "@/lib/auth/session";
import { handleRouteError } from "@/lib/validation/api";

// Flat list of all sites for the org — used by the field-worker invite
// generator so an admin can scope an invite link to a specific site.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ orgId: string }> },
) {
  try {
    const { orgId } = await params;
    await requireOrgMember(orgId, "admin", "editor", "reviewer");

    const sites = await prisma.site.findMany({
      where: { organizationId: orgId },
      select: {
        id: true,
        name: true,
        siteCode: true,
        postcode: true,
        project: { select: { id: true, name: true } },
      },
      orderBy: [{ project: { name: "asc" } }, { name: "asc" }],
    });

    return NextResponse.json(sites);
  } catch (err) {
    return handleRouteError(err);
  }
}
