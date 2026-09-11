export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireOrgMember } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { handleRouteError, apiError } from "@/lib/validation/api";
import { searchByRegistrationNumber, searchByName } from "@/lib/data-sources/gleif";

type Params = { params: Promise<{ orgId: string; entityId: string }> };

/**
 * POST /api/orgs/:orgId/legal-entities/:entityId/lookup-lei
 *
 * Queries GLEIF by registration number (preferred) or entity name,
 * then writes gleifLei / gleifStatus / gleifLookedUpAt to the entity.
 * Idempotent — safe to re-run if the status changes.
 */
export async function POST(_req: NextRequest, { params }: Params) {
  try {
    const { orgId, entityId } = await params;
    await requireOrgMember(orgId, "admin", "editor");

    const entity = await prisma.legalEntity.findFirst({
      where: { id: entityId, organizationId: orgId },
      select: { id: true, name: true, registrationNumber: true, country: true },
    });

    if (!entity) return apiError("NOT_FOUND", "Legal entity not found.", 404);

    let match = null;

    if (entity.registrationNumber && entity.country) {
      match = await searchByRegistrationNumber(entity.registrationNumber, entity.country);
    }

    if (!match) {
      match = await searchByName(entity.name, entity.country ?? undefined);
    }

    if (!match) {
      return NextResponse.json(
        { found: false, message: "No GLEIF record found for this entity." },
        { status: 200 },
      );
    }

    await prisma.legalEntity.update({
      where: { id: entityId },
      data: {
        gleifLei: match.lei,
        gleifStatus: match.status,
        gleifLookedUpAt: new Date(),
      },
    });

    return NextResponse.json({
      found: true,
      lei: match.lei,
      status: match.status,
      legalName: match.legalName,
    });
  } catch (err) {
    return handleRouteError(err);
  }
}
