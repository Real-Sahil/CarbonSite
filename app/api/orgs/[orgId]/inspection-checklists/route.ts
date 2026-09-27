export const dynamic = "force-dynamic";

// Inspection checklists for the field app: title and items only. Any member,
// field workers included, can read them; nothing else about the organisation
// is returned.

import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireOrgMember } from "@/lib/auth/session";
import { handleRouteError } from "@/lib/validation/api";
import { checklistItems } from "@/lib/management-systems/registers/server";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ orgId: string }> }) {
  try {
    const { orgId } = await params;
    await requireOrgMember(orgId);
    const rows = await prisma.msInspectionTemplate.findMany({
      where: { organizationId: orgId },
      select: { id: true, title: true, items: true, frequency: true },
      orderBy: { title: "asc" },
      take: 200,
    });
    return Response.json({ data: rows.map((r) => ({ id: r.id, title: r.title, frequency: r.frequency, items: checklistItems(r.items) })) });
  } catch (err) {
    return handleRouteError(err);
  }
}
