/**
 * Server-Sent Events endpoint for real-time dashboard updates.
 * GET /api/orgs/:orgId/dashboard/stream
 *
 * Streams DashboardAggregate updates as calculation runs complete.
 * Client opens persistent connection; server sends events as they occur.
 * Automatic reconnection on connection loss (client-side).
 *
 * Response format (text/event-stream):
 * data: {aggregates, timestamp, calculationRunId}
 */

import { NextRequest, NextResponse } from "next/server";
import { requireOrgMember, ROLE_GROUPS } from "@/lib/auth/session";
import { subscribeToDashboardUpdates } from "@/lib/realtime/subscription-manager";
import { withApiVersion, checkDeprecationWarning } from "@/lib/api/versioned-handler";
import { requireFeature } from "@/lib/billing/limits";

type Params = { params: Promise<{ orgId: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { orgId } = await params;
    const { version } = await withApiVersion(_req);

    const deprecationWarning = checkDeprecationWarning(version);
    if (deprecationWarning) {
      console.warn(`[API v${version}] ${deprecationWarning}`);
    }

    // Verify org membership and role (viewers can see live dashboard)
    await requireOrgMember(orgId, ...ROLE_GROUPS.anyMember);

    const gate = await requireFeature(orgId, "liveDashboard");
    if (gate) return gate;

    // Set up SSE headers (versioning applied here for streaming response)
    const headers = new Headers({
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no", // Disable Nginx buffering
      "API-Version": version,
    });

    // Create custom readable stream
    let isConnected = true;
    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      start(controller) {
        // Send initial comment to verify connection
        controller.enqueue(encoder.encode(": connected\n\n"));

        // Subscribe to dashboard updates
        const unsubscribe = subscribeToDashboardUpdates(orgId, (update) => {
          if (!isConnected) return;

          try {
            const data = JSON.stringify(update);
            controller.enqueue(encoder.encode(`data: ${data}\n\n`));
          } catch (err) {
            console.error(`Error sending SSE update: ${err}`);
            isConnected = false;
            controller.close();
          }
        });

        // Send heartbeat every 30 seconds to keep connection alive
        const heartbeatInterval = setInterval(() => {
          if (!isConnected) {
            clearInterval(heartbeatInterval);
            return;
          }
          try {
            controller.enqueue(encoder.encode(": heartbeat\n\n"));
          } catch {
            isConnected = false;
            clearInterval(heartbeatInterval);
          }
        }, 30000);

        // Cleanup on request abort
        _req.signal.addEventListener("abort", () => {
          isConnected = false;
          clearInterval(heartbeatInterval);
          unsubscribe();
          controller.close();
        });
      },
    });

    return new NextResponse(stream, { headers });
  } catch (error) {
    if (error instanceof Error && error.message.includes("Unauthorized")) {
      return new NextResponse("Unauthorized", { status: 401 });
    }
    console.error(`Dashboard stream error: ${error}`);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
