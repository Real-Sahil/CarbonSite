import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireOrgMember } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { writeAuditLog } from "@/lib/db/audit";
import { handleRouteError, apiError } from "@/lib/validation/api";

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

async function getWebhookOrThrow(orgId: string, webhookId: string) {
  const webhook = await prisma.webhook.findUnique({ where: { id: webhookId } });
  if (!webhook || webhook.organizationId !== orgId) {
    throw { code: "NOT_FOUND", message: "Webhook not found", status: 404 };
  }
  return webhook;
}

// GET /api/orgs/[orgId]/webhooks/[webhookId]
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ orgId: string; webhookId: string }> },
) {
  try {
    const { orgId, webhookId } = await params;
    await requireOrgMember(orgId, "admin");

    const webhook = await getWebhookOrThrow(orgId, webhookId);
    return NextResponse.json({ data: { ...webhook, secret: redactSecret(webhook.secret) } });
  } catch (err) {
    return handleRouteError(err);
  }
}

const updateWebhookSchema = z.object({
  url: z
    .string()
    .url("Must be a valid URL")
    .refine((u) => u.startsWith("https://"), "URL must start with https://")
    .optional(),
  events: z
    .array(z.enum(ALLOWED_EVENTS))
    .min(1, "At least one event is required")
    .optional(),
  enabled: z.boolean().optional(),
});

// PATCH /api/orgs/[orgId]/webhooks/[webhookId]
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ orgId: string; webhookId: string }> },
) {
  try {
    const { orgId, webhookId } = await params;
    await requireOrgMember(orgId, "admin");

    await getWebhookOrThrow(orgId, webhookId);

    const body = updateWebhookSchema.parse(await req.json());

    const updated = await prisma.webhook.update({
      where: { id: webhookId },
      data: {
        ...(body.url !== undefined && { url: body.url }),
        ...(body.events !== undefined && { events: body.events }),
        ...(body.enabled !== undefined && { enabled: body.enabled }),
      },
    });

    return NextResponse.json({ data: { ...updated, secret: redactSecret(updated.secret) } });
  } catch (err) {
    return handleRouteError(err);
  }
}

// DELETE /api/orgs/[orgId]/webhooks/[webhookId]
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ orgId: string; webhookId: string }> },
) {
  try {
    const { orgId, webhookId } = await params;
    const { session } = await requireOrgMember(orgId, "admin");

    await getWebhookOrThrow(orgId, webhookId);

    await prisma.webhook.delete({ where: { id: webhookId } });

    await writeAuditLog({
      organizationId: orgId,
      actorUserId: session.user.id,
      action: "webhook.deleted",
      resourceType: "Webhook",
      resourceId: webhookId,
    });

    return new NextResponse(null, { status: 204 });
  } catch (err) {
    return handleRouteError(err);
  }
}
