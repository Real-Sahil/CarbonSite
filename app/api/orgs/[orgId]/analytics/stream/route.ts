/**
 * Real-time Analytics Stream via Server-Sent Events
 *
 * Broadcasts analytics updates as calculations complete, snapshots publish, or anomalies emerge.
 * Clients subscribe to org-scoped events and receive:
 * - calculation_progress (% complete, rows processed)
 * - analytics_updated (new aggregates, trends, breakdowns)
 * - anomaly_detected (data quality or emission outliers)
 * - error (calculation failed)
 */

import { NextRequest, NextResponse } from "next/server";
import { requireOrgMember } from "@/lib/auth/session";
import { prisma } from "@/lib/db";

interface AnalyticsEvent {
  type: "calculation_progress" | "analytics_updated" | "anomaly_detected" | "error" | "heartbeat";
  orgId: string;
  timestamp: string;
  data: Record<string, unknown>;
}

// In-memory pub/sub for analytics events
// In production, use Redis Pub/Sub for multi-process deployments
const analyticsSubscribers = new Map<string, Set<(event: AnalyticsEvent) => void>>();

export function broadcastAnalyticsEvent(event: AnalyticsEvent): void {
  const subscribers = analyticsSubscribers.get(event.orgId);
  if (subscribers) {
    subscribers.forEach((callback) => callback(event));
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  const { orgId } = await params;
  const userId = (await requireOrgMember(orgId)).userId;

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Set up SSE response
  const encoder = new TextEncoder();
  let isClosed = false;

  const stream = new ReadableStream({
    start(controller) {
      const handler = (event: AnalyticsEvent) => {
        try {
          const message = `data: ${JSON.stringify(event)}\n\n`;
          controller.enqueue(encoder.encode(message));
        } catch (error) {
          console.error("SSE encode error:", error);
        }
      };

      // Register subscriber
      if (!analyticsSubscribers.has(orgId)) {
        analyticsSubscribers.set(orgId, new Set());
      }
      analyticsSubscribers.get(orgId)!.add(handler);

      // Send initial heartbeat
      controller.enqueue(
        encoder.encode(
          `data: ${JSON.stringify({
            type: "heartbeat",
            orgId,
            timestamp: new Date().toISOString(),
            data: { message: "Connected to analytics stream" },
          })}\n\n`
        )
      );

      // Heartbeat every 30 seconds to keep connection alive
      const heartbeatInterval = setInterval(() => {
        if (isClosed) {
          clearInterval(heartbeatInterval);
          return;
        }
        try {
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({
                type: "heartbeat",
                orgId,
                timestamp: new Date().toISOString(),
                data: { keepAlive: true },
              })}\n\n`
            )
          );
        } catch (error) {
          clearInterval(heartbeatInterval);
        }
      }, 30000);

      // Cleanup on abort
      const abortListener = () => {
        isClosed = true;
        clearInterval(heartbeatInterval);
        const subscribers = analyticsSubscribers.get(orgId);
        if (subscribers) {
          subscribers.delete(handler);
          if (subscribers.size === 0) {
            analyticsSubscribers.delete(orgId);
          }
        }
        controller.close();
      };

      req.signal.addEventListener("abort", abortListener);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no", // Disable Nginx buffering
    },
  });
}
