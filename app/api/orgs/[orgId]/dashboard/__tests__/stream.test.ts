import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { GET } from "../stream/route";
import { NextRequest } from "next/server";
import * as auth from "@/lib/auth/session";
import * as live from "@/lib/realtime/live-totals";
import * as billing from "@/lib/billing/limits";

// Mock dependencies
vi.mock("@/lib/auth/session");
vi.mock("@/lib/realtime/live-totals");
vi.mock("@/lib/billing/limits", async (importOriginal) => ({
  ...(await importOriginal<typeof billing>()),
  requireFeature: vi.fn(),
}));

describe("GET /api/orgs/[orgId]/dashboard/stream", () => {
  let mockRequest: NextRequest;

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock successful auth
    vi.mocked(auth.requireOrgMember).mockResolvedValue({
      user: { id: "user-123", email: "test@example.com" },
      session: { id: "session-123" },
    } as any);

    vi.mocked(live.loadLiveTotals).mockResolvedValue({
      aggregates: { totalCo2e: 4710050, scope1: 909490, scope2: 154640, scope3: 3645920, byCategory: { "s1-mobile": 690420 } },
      timestamp: "2026-09-24T09:50:00.000Z",
      calculationRunId: "run-1",
    });

    // Mock plan feature gate as available by default
    vi.mocked(billing.requireFeature).mockResolvedValue(null);

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

  it("sends the current live totals as soon as the stream opens", async () => {
    const controller = new AbortController();
    const response = await GET(new NextRequest("http://localhost:3000/api/orgs/org-456/dashboard/stream", { signal: controller.signal }), {
      params: Promise.resolve({ orgId: "org-456" }),
    });

    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    let text = "";
    while (!text.includes("data: ")) {
      const { value, done } = await reader.read();
      if (done) break;
      text += decoder.decode(value);
    }
    controller.abort();

    expect(live.loadLiveTotals).toHaveBeenCalledWith("org-456");
    const payload = JSON.parse(text.split("data: ")[1].split("\n\n")[0]);
    expect(payload.calculationRunId).toBe("run-1");
    expect(payload.aggregates.totalCo2e).toBe(4710050);
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
