import crypto from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";

export async function deliverWebhook(
  orgId: string,
  event: string,
  payload: Record<string, unknown>,
): Promise<void> {
  let webhooks;
  try {
    webhooks = await prisma.webhook.findMany({
      where: { organizationId: orgId, enabled: true, events: { has: event } },
    });
  } catch {
    // If we cannot query webhooks, fail silently — delivery must never throw
    return;
  }

  await Promise.allSettled(
    webhooks.map(async (webhook) => {
      const timestamp = new Date().toISOString();

      // Create delivery record before attempting
      let delivery;
      try {
        delivery = await prisma.webhookDelivery.create({
          data: {
            webhookId: webhook.id,
            event,
            payload: payload as Prisma.InputJsonObject,
            attempts: 0,
          },
        });
      } catch {
        // Cannot record delivery — skip silently
        return;
      }

      const body = JSON.stringify({ event, payload, timestamp });

      const sig = crypto
        .createHmac("sha256", webhook.secret)
        .update(body)
        .digest("hex");

      let statusCode: number | null = null;
      let succeededAt: Date | null = null;

      try {
        const response = await fetch(webhook.url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-CarbonSite-Signature": sig,
            "X-CarbonSite-Event": event,
          },
          body,
          signal: AbortSignal.timeout(10_000),
        });

        statusCode = response.status;
        succeededAt = response.ok ? new Date() : null;
      } catch {
        // Network error or timeout — statusCode stays null
      }

      try {
        await prisma.webhookDelivery.update({
          where: { id: delivery.id },
          data: {
            statusCode,
            attempts: 1,
            succeededAt,
          },
        });
      } catch {
        // Failed to update delivery record — fail silently
      }
    }),
  );
}
