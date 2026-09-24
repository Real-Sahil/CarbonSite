/**
 * Server-Sent Events endpoint for real-time dashboard updates.
 * GET /api/orgs/:orgId/dashboard/stream
 *
 * Sends the latest period's live totals straight away, then again whenever a
 * newer calculation run changes them. The database is polled rather than an
 * in-process event bus: on Vercel the run that finishes a calculation is in a
 * different function instance from this stream. The stream ends before the
 * function's time limit and EventSource reconnects on its own.
 *
 * Response format (text/event-stream):
 * data: {aggregates, timestamp, calculationRunId}
 */

import { NextRequest, NextResponse } from "next/server";
import { requireOrgMember, ROLE_GROUPS } from "@/lib/auth/session";
import { loadLiveTotals } from "@/lib/realtime/live-totals";
import { withApiVersion, checkDeprecationWarning } from "@/lib/api/versioned-handler";
import { requireFeature } from "@/lib/billing/limits";

type Params = { params: Promise<{ orgId: string }> };

export const maxDuration = 300;
const POLL_MS = 15_000;
const STREAM_MS = 280_000;

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
        let lastSent = "";
        const send = (chunk: string) => {
          if (!isConnected) return;
          try {
            controller.enqueue(encoder.encode(chunk));
          } catch {
            isConnected = false;
          }
        };
        const push = async () => {
          try {
            const totals = await loadLiveTotals(orgId);
            if (!totals) return;
            const key = `${totals.calculationRunId}:${totals.aggregates.totalCo2e}`;
            if (key === lastSent) return;
            lastSent = key;
            send(`data: ${JSON.stringify(totals)}\n\n`);
          } catch (err) {
            console.error(`Dashboard stream query failed: ${err}`);
          }
        };

        send(": connected\n\n");
        void push();
        const poll = setInterval(() => {
          void push();
          send(": heartbeat\n\n");
        }, POLL_MS);
        const stop = () => {
          if (!isConnected) return;
          isConnected = false;
          clearInterval(poll);
          clearTimeout(end);
          try {
            controller.close();
          } catch {
            // already closed
          }
        };
        const end = setTimeout(stop, STREAM_MS);
        _req.signal.addEventListener("abort", stop);
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
