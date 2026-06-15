import crypto from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireOrgMember } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { writeAuditLog } from "@/lib/db/audit";
import { handleRouteError } from "@/lib/validation/api";

const ALLOWED_EVENTS = [
  "calculation_run.completed",
  "report.ready",
  "field_submission.approved",
  "field_submission.rejected",
  "import.committed",
] as const;

function redactSecret(secret: string): string {
  return secret.slice(0, 8) + "...";
}

// GET /api/orgs/[orgId]/webhooks
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ orgId: string }> },
) {
  try {
    const { orgId } = await params;
    await requireOrgMember(orgId, "admin");

    const webhooks = await prisma.webhook.findMany({
      where: { organizationId: orgId },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({
      data: webhooks.map((w) => ({ ...w, secret: redactSecret(w.secret) })),
    });
  } catch (err) {
    return handleRouteError(err);
  }
}

const createWebhookSchema = z.object({
  url: z
    .string()
    .url("Must be a valid URL")
    .refine((u) => u.startsWith("https://"), "URL must start with https://"),
  events: z
    .array(z.enum(ALLOWED_EVENTS))
    .min(1, "At least one event is required"),
  secret: z.string().optional(),
});

// POST /api/orgs/[orgId]/webhooks
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ orgId: string }> },
) {
  try {
    const { orgId } = await params;
    const { session } = await requireOrgMember(orgId, "admin");

    const body = createWebhookSchema.parse(await req.json());
    const secret = body.secret ?? crypto.randomBytes(32).toString("hex");

    const webhook = await prisma.webhook.create({
      data: {
        organizationId: orgId,
        url: body.url,
        events: body.events,
        secret,
        createdByUserId: session.user.id,
      },
    });

    await writeAuditLog({
      organizationId: orgId,
      actorUserId: session.user.id,
      action: "webhook.created",
      resourceType: "Webhook",
      resourceId: webhook.id,
      metadata: { url: webhook.url, events: webhook.events },
    });

    // Return full secret — only time it's shown
    return NextResponse.json({ data: webhook }, { status: 201 });
  } catch (err) {
    return handleRouteError(err);
  }
}
