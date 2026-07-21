import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireOrgMember } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/db/audit";
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

const quickCreateSiteSchema = z.object({
  name: z.string().min(1).max(200),
  postcode: z.string().max(20).optional(),
});

// Quick site creation. Site requires a Project which requires a Contract —
// a three-level chain no new org has completed, which blocked the entire
// field-capture flow ("no sites available" on every device). When the org
// has no contract/project yet, a default "General" pair is auto-provisioned
// so an admin can create a usable site in one step and refine the hierarchy
// later from the Contracts page.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ orgId: string }> },
) {
  try {
    const { orgId } = await params;
    const { session } = await requireOrgMember(orgId, "admin", "editor");
    const body = quickCreateSiteSchema.parse(await req.json());

    const site = await prisma.$transaction(async (tx) => {
      let contract = await tx.contract.findFirst({
        where: { organizationId: orgId, name: "General" },
        select: { id: true },
      });
      contract ??= await tx.contract.create({
        data: {
          organizationId: orgId,
          name: "General",
          status: "active",
          createdByUserId: session.user.id,
          notes: "Auto-created to hold quick-created sites. Rename or reorganise under Contracts.",
        },
        select: { id: true },
      });

      let project = await tx.project.findFirst({
        where: { organizationId: orgId, contractId: contract.id, name: "General" },
        select: { id: true },
      });
      project ??= await tx.project.create({
        data: {
          organizationId: orgId,
          contractId: contract.id,
          name: "General",
          status: "active",
        },
        select: { id: true },
      });

      return tx.site.create({
        data: {
          organizationId: orgId,
          projectId: project.id,
          name: body.name.trim(),
          postcode: body.postcode?.trim() || undefined,
        },
        select: {
          id: true,
          name: true,
          postcode: true,
          project: { select: { id: true, name: true } },
        },
      });
    });

    await writeAuditLog({
      organizationId: orgId,
      actorUserId: session.user.id,
      action: "site.created",
      resourceType: "site",
      resourceId: site.id,
      metadata: { name: site.name, quickCreate: true },
    });

    return NextResponse.json(site, { status: 201 });
  } catch (err) {
    return handleRouteError(err);
  }
}
