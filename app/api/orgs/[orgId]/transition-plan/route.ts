export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireOrgMember, ROLE_GROUPS } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/db/audit";
import { handleRouteError } from "@/lib/validation/api";
import { loadTransitionPlan } from "@/lib/transition-plan/load";

const READ_ROLES = [...ROLE_GROUPS.editor, "reviewer", "viewer", "auditor"] as const;

const text = z.string().trim().max(10_000).nullable().optional().transform((v) => (v ? v : null));
const money = z.number().min(0).max(1e13).nullable().optional().transform((v) => v ?? null);

const planSchema = z.object({
  ambition: text,
  netZeroYear: z.number().int().min(2025).max(2070).nullable().optional().transform((v) => v ?? null),
  strategy: text,
  engagement: text,
  governance: text,
  lockedInEmissions: text,
  capexPlanned: money,
  opexPlanned: money,
  currency: z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/, "Use a three-letter currency code.").default("GBP"),
  taxonomyAlignedCapexPct: z.number().min(0).max(100).nullable().optional().transform((v) => v ?? null),
});

// GET /api/orgs/[orgId]/transition-plan
export async function GET(_req: NextRequest, { params }: { params: Promise<{ orgId: string }> }) {
  try {
    const { orgId } = await params;
    await requireOrgMember(orgId, ...READ_ROLES);
    return NextResponse.json(await loadTransitionPlan(orgId));
  } catch (err) {
    return handleRouteError(err);
  }
}

// PUT /api/orgs/[orgId]/transition-plan
// Saving changes to an approved plan returns it to draft: the board approved
// the old text, not the new one. The audit log keeps the approval.
export async function PUT(req: NextRequest, { params }: { params: Promise<{ orgId: string }> }) {
  try {
    const { orgId } = await params;
    const { session } = await requireOrgMember(orgId, ...ROLE_GROUPS.editor);
    const body = planSchema.parse(await req.json());

    const existing = await prisma.transitionPlan.findUnique({ where: { organizationId: orgId }, select: { id: true, status: true } });
    const reopened = existing?.status === "approved";
    const plan = await prisma.transitionPlan.upsert({
      where: { organizationId: orgId },
      create: { ...body, organizationId: orgId, updatedByUserId: session.user.id },
      update: {
        ...body,
        updatedByUserId: session.user.id,
        ...(reopened ? { status: "draft", approvedAt: null, approvedByUserId: null } : {}),
      },
    });

    await writeAuditLog({
      organizationId: orgId,
      actorUserId: session.user.id,
      action: "transition_plan.updated",
      resourceType: "TransitionPlan",
      resourceId: plan.id,
      metadata: { created: !existing, reopenedFromApproved: reopened, netZeroYear: body.netZeroYear },
    });

    return NextResponse.json({ plan, reopened });
  } catch (err) {
    return handleRouteError(err);
  }
}
