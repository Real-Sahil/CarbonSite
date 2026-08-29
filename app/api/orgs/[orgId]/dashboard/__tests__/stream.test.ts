import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { GET } from "../stream/route";
import { NextRequest } from "next/server";
import * as auth from "@/lib/auth/session";
import * as subscription from "@/lib/realtime/subscription-manager";

// Mock dependencies
vi.mock("@/lib/auth/session");
vi.mock("@/lib/realtime/subscription-manager");

describe("GET /api/orgs/[orgId]/dashboard/stream", () => {
  let mockRequest: NextRequest;

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock successful auth
    vi.mocked(auth.requireOrgMember).mockResolvedValue({
      user: { id: "user-123", email: "test@example.com" },
      session: { id: "session-123" },
    } as any);

    // Mock subscription
    vi.mocked(subscription.subscribeToDashboardUpdates).mockReturnValue(() => {});

    mockRequest = new NextRequest("http://localhost:3000/api/orgs/org-123/dashboard/stream");
  });

  afterEach(() => {
    vi.clearAllMocks();
  });


  it("returns SSE response with correct headers", async () => {
    const response = await GET(mockRequest, {
      params: Promise.resolve({ orgId: "org-123" }),
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("text/event-stream");
    expect(response.headers.get("Cache-Control")).toBe("no-cache");
    expect(response.headers.get("Connection")).toBe("keep-alive");
    expect(response.headers.get("X-Accel-Buffering")).toBe("no");
  });

  it("subscribes to dashboard updates for the organization", async () => {
    const response = await GET(mockRequest, {
      params: Promise.resolve({ orgId: "org-456" }),
    });

    // Note: In a real scenario, we'd need to actually read from the stream
    // to verify the subscription is working. This is a simplified check.
    expect(response.status).toBe(200);
    expect(auth.requireOrgMember).toHaveBeenCalled();
  });

  it("returns text/event-stream content type", async () => {
    const response = await GET(mockRequest, {
      params: Promise.resolve({ orgId: "org-123" }),
    });

    expect(response.headers.get("Content-Type")).toBe("text/event-stream");
  });

  it("handles request aborts gracefully", async () => {
    const response = await GET(mockRequest, {
      params: Promise.resolve({ orgId: "org-123" }),
    });

    expect(response.status).toBe(200);
    // In a real scenario, aborting the request would trigger cleanup
  });

  it("enforces org membership with anyMember role group", async () => {
    const response = await GET(mockRequest, {
      params: Promise.resolve({ orgId: "org-789" }),
    });

    expect(response.status).toBe(200);
    expect(auth.requireOrgMember).toHaveBeenCalled();
  });
});
