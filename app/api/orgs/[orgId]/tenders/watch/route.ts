export const dynamic = "force-dynamic";

/** GET/PUT /api/orgs/{orgId}/tenders/watch: what to look for on Find a Tender. */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireOrgMember } from "@/lib/auth/session";
import { TENDER_EDITORS, TENDER_READERS } from "@/lib/tenders/fts";
import { writeAuditLog } from "@/lib/db/audit";
import { apiError, handleRouteError } from "@/lib/validation/api";
import { requireFeature } from "@/lib/billing/limits";

const list = (item: z.ZodType<string>, max: number) => z.array(item).max(max).transform((a) => [...new Set(a.map((s) => s.trim()).filter(Boolean))]);
const watchSchema = z
  .object({
    enabled: z.boolean().default(true),
    cpvPrefixes: list(z.string().regex(/^\d{2,8}$/, "CPV prefixes are 2 to 8 digits."), 30),
    regions: list(z.string().regex(/^UK[A-N0-9]{0,4}$/i, "Regions are ITL codes such as UKE or UKI3.").transform((s) => s.toUpperCase()), 30),
    keywords: list(z.string().max(60), 20),
    minValue: z.number().min(0).max(1e13).nullable().optional(),
  })
  .refine((w) => w.cpvPrefixes.length > 0 || w.keywords.length > 0, { message: "Add at least one CPV code or keyword.", path: ["cpvPrefixes"] });

export async function GET(_req: NextRequest, { params }: { params: Promise<{ orgId: string }> }) {
  try {
    const { orgId } = await params;
    await requireOrgMember(orgId, ...TENDER_READERS);
    const watch = await prisma.tenderWatch.findUnique({ where: { organizationId: orgId } });
    return NextResponse.json({ watch });
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ orgId: string }> }) {
  try {
    const { orgId } = await params;
    const { session } = await requireOrgMember(orgId, ...TENDER_EDITORS);
    const gate = await requireFeature(orgId, "bidCarbonPack");
    if (gate) return gate;
    const parsed = watchSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return apiError("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Invalid watch.", 400, parsed.error.flatten());
    const data = { ...parsed.data, minValue: parsed.data.minValue ?? null, updatedByUserId: session.user.id };
    const watch = await prisma.tenderWatch.upsert({
      where: { organizationId: orgId },
      create: { ...data, organizationId: orgId },
      update: data,
    });
    await writeAuditLog({
      organizationId: orgId,
      actorUserId: session.user.id,
      action: "tender.watch_updated",
      resourceType: "TenderWatch",
      resourceId: watch.id,
      metadata: { enabled: watch.enabled, cpvPrefixes: watch.cpvPrefixes, regions: watch.regions, keywords: watch.keywords },
    });
    return NextResponse.json({ watch });
  } catch (err) {
    return handleRouteError(err);
  }
}
