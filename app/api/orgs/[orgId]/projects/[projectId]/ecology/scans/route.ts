export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireOrgMember } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { handleRouteError, apiError } from "@/lib/validation/api";
import { runEcologicalScan } from "@/lib/ecology/scan";

type Params = { params: Promise<{ orgId: string; projectId: string }> };

const CreateScanBody = z.object({
  postcode: z.string().min(1).max(10),
  radiusKm: z.number().min(0.1).max(20).default(1),
});

/**
 * GET /api/orgs/:orgId/projects/:projectId/ecology/scans
 * List all scans for a project, newest first.
 */
export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { orgId, projectId } = await params;
    await requireOrgMember(orgId, "admin", "editor", "reviewer", "viewer", "auditor", "sustainability_director");

    const project = await prisma.project.findFirst({
      where: { id: projectId, organizationId: orgId },
      select: { id: true },
    });
    if (!project) return apiError("NOT_FOUND", "Project not found.", 404);

    const url = new URL(_req.url);
    const cursor = url.searchParams.get("cursor");
    const take = 20;

    const scans = await prisma.ecologicalScan.findMany({
      where: { projectId, organizationId: orgId },
      orderBy: { createdAt: "desc" },
      take: take + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      select: {
        id: true,
        postcode: true,
        radiusKm: true,
        status: true,
        scannedAt: true,
        errorMessage: true,
        totalSpeciesCount: true,
        plantSpeciesCount: true,
        birdSpeciesCount: true,
        mammalSpeciesCount: true,
        invertSpeciesCount: true,
        reptileSpeciesCount: true,
        amphibianSpeciesCount: true,
        otherSpeciesCount: true,
        sssiCount: true,
        sacCount: true,
        spaCount: true,
        nvrCount: true,
        ancientWoodlandCount: true,
        ramsarCount: true,
        aonbCount: true,
        lnrCount: true,
        woodlandTotalHa: true,
        broadleafHa: true,
        coniferHa: true,
        mixedWoodlandHa: true,
        priorityHabitatHa: true,
        speciesRecords: true,
        designatedSites: true,
        woodlandData: true,
        createdAt: true,
        createdBy: { select: { name: true, email: true } },
      },
    });

    const hasMore = scans.length > take;
    const page = hasMore ? scans.slice(0, take) : scans;
    const nextCursor = hasMore ? page[page.length - 1].id : null;

    return NextResponse.json({ data: page, nextCursor });
  } catch (err) {
    return handleRouteError(err);
  }
}

/**
 * POST /api/orgs/:orgId/projects/:projectId/ecology/scans
 * Create and immediately run an ecological scan.
 * Body: { postcode, radiusKm? }
 */
export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { orgId, projectId } = await params;
    const { session } = await requireOrgMember(orgId, "admin", "editor", "sustainability_director");

    const project = await prisma.project.findFirst({
      where: { id: projectId, organizationId: orgId },
      select: { id: true },
    });
    if (!project) return apiError("NOT_FOUND", "Project not found.", 404);

    const body = CreateScanBody.parse(await req.json());

    const scan = await prisma.ecologicalScan.create({
      data: {
        organizationId: orgId,
        projectId,
        postcode: body.postcode.toUpperCase().trim(),
        radiusKm: body.radiusKm,
        status: "pending",
        createdByUserId: session.user.id,
      },
    });

    // Run inline (Vercel serverless — no separate worker)
    await runEcologicalScan(scan.id);

    const updated = await prisma.ecologicalScan.findUniqueOrThrow({
      where: { id: scan.id },
    });

    return NextResponse.json(updated, { status: 201 });
  } catch (err) {
    return handleRouteError(err);
  }
}
