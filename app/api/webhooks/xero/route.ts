import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { enqueueXeroSync } from "@/lib/jobs/queues/index";
import crypto from "crypto";

export const dynamic = "force-dynamic";

/**
 * Xero webhook endpoint for invoice events.
 *
 * Xero will POST events here when invoices are created or updated.
 * Events include signatures that can be verified using XERO_WEBHOOK_KEY.
 *
 * See: https://developer.xero.com/documentation/guides/webhooks/webhooks-overview/
 */

export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const signature = request.headers.get("x-xero-signature");

    // Verify the webhook signature if configured
    const webhookKey = process.env.XERO_WEBHOOK_KEY;
    if (webhookKey && signature) {
      const hash = crypto
        .createHmac("sha256", webhookKey)
        .update(body)
        .digest("base64");

      if (hash !== signature) {
        console.warn("[Xero Webhook] Invalid signature");
        return new NextResponse(null, { status: 401 });
      }
    }

    const payload = JSON.parse(body);

    // Xero webhook payload structure:
    // {
    //   "events": [
    //     {
    //       "resourceUrl": "https://api.xero.com/api.xro/2.0/Invoices/...",
    //       "resourceId": "...",
    //       "eventCategory": "INVOICE",
    //       "eventType": "CREATE" | "UPDATE" | "DELETE",
    //       "utcTimeStamp": "2024-01-01T12:00:00.000Z"
    //     }
    //   ]
    // }

    const events = payload.events ?? [];

    for (const event of events) {
      if (event.eventCategory !== "INVOICE") {
        continue;
      }

      // Extract org ID from the resource URL
      // Format: https://api.xero.com/api.xro/2.0/Invoices/INVOICE_ID
      // We need to look up which org this belongs to by the invoice ID or tenant ID

      // Parse the resource URL to get the tenant ID (which we stored as externalTenantId)
      // Unfortunately, the webhook doesn't include the tenant ID directly,
      // so we'd need to query all connected Xero orgs and sync them all,
      // or store a mapping of tenant ID to org ID.

      console.log(`[Xero Webhook] Received ${event.eventType} event for invoice ${event.resourceId}`);

      // For now, trigger a sync for all organizations with Xero connected
      // In production, this should be optimized to only sync the affected org
      const xeroConnections = await prisma.integrationConnection.findMany({
        where: { provider: "xero" },
        select: { organizationId: true },
        distinct: ["organizationId"],
      });

      for (const connection of xeroConnections) {
        await enqueueXeroSync({
          orgId: connection.organizationId,
          fromDate: new Date(Date.now() - 60 * 60 * 1000).toISOString(), // Last hour
        });
      }
    }

    // Always return 200 to acknowledge receipt
    // Xero will retry failed webhooks up to 5 times
    return NextResponse.json({ acknowledged: true });
  } catch (error) {
    console.error("[Xero Webhook] Error:", error);
    // Still return 200 to prevent Xero retries on parse errors
    return NextResponse.json({ error: true }, { status: 200 });
  }
}
